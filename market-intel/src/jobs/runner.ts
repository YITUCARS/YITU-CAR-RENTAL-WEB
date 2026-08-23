import { hostname } from 'node:os';
import type { AppConfig, SourceConfig } from '../config/types.js';
import { findSource } from '../config/types.js';
import type { Db } from '../database/client.js';
import { jobsRepo, observationsRepo } from '../database/repositories/index.js';
import type { JobRow } from '../database/repositories/jobs.js';
import { createCollector } from '../collectors/registry.js';
import type { RentalPriceCollector } from '../collectors/types.js';
import { VehicleClassifier, FALLBACK_RULES, toMappingRule } from '../normalizers/vehicle-class.js';
import { ArtifactStore } from '../utils/artifacts.js';
import { logger, scoped } from '../utils/logger.js';
import { RateLimiterRegistry } from '../utils/rate-limiter.js';
import { executeJob, handleJobFailure } from './execute.js';

export interface RunnerOptions {
  /** stop after this many jobs (smoke tests) */
  maxJobs?: number;
  /** only work on one source */
  sourceCode?: string;
  /** only work on one run */
  runId?: string;
  /** keep polling for new work instead of exiting when the queue drains */
  daemon?: boolean;
  pollIntervalMs?: number;
}

export interface RunnerSummary {
  processed: number;
  succeeded: number;
  failed: number;
  offersStored: number;
}

/**
 * Pulls jobs off the queue and runs them.
 *
 * Concurrency is bounded twice over: globally by runner.max_concurrency, and
 * per source by that source's own rate limiter. Two workers may both hold a
 * job for the same source, but the limiter still spaces the actual requests.
 */
export class CollectionRunner {
  private readonly limiters = new RateLimiterRegistry();
  private readonly collectors = new Map<string, RentalPriceCollector>();
  private readonly artifacts: ArtifactStore;
  private classifier: VehicleClassifier;
  private readonly workerId: string;
  private stopping = false;

  constructor(
    private readonly db: Db,
    private readonly config: AppConfig,
  ) {
    this.artifacts = new ArtifactStore(config.env.artifactsDir);
    this.classifier = new VehicleClassifier(FALLBACK_RULES);
    this.workerId = `${hostname()}:${process.pid}`;
  }

  /** Loads the mapping table once per run; falls back to the built-in rules. */
  async init(): Promise<void> {
    try {
      const rows = await observationsRepo.loadMappingRules(this.db);
      if (rows.length > 0) {
        this.classifier = new VehicleClassifier(rows.map(toMappingRule));
        logger.info({ rules: rows.length }, 'loaded vehicle class mapping');
      } else {
        logger.warn('vehicle_class_mapping is empty; using built-in fallback rules');
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'could not load mapping rules; using fallbacks');
    }

    const released = await jobsRepo.releaseStaleJobs(this.db, this.config.runner.jobLockTimeoutMs);
    if (released > 0) logger.warn({ released }, 'released stale running jobs');
  }

  stop(): void {
    this.stopping = true;
  }

  async run(options: RunnerOptions = {}): Promise<RunnerSummary> {
    await this.init();

    const summary: RunnerSummary = { processed: 0, succeeded: 0, failed: 0, offersStored: 0 };
    const concurrency = Math.max(1, this.config.runner.maxConcurrency);
    const pollIntervalMs = options.pollIntervalMs ?? 5000;

    const worker = async (): Promise<void> => {
      for (;;) {
        if (this.stopping) return;
        if (options.maxJobs !== undefined && summary.processed >= options.maxJobs) return;

        const job = await jobsRepo.claimNextJob(this.db, this.workerId, {
          sourceCode: options.sourceCode,
          runId: options.runId,
        });

        if (!job) {
          if (!options.daemon) return;
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          continue;
        }

        summary.processed++;
        const outcome = await this.processJob(job);
        if (outcome.ok) {
          summary.succeeded++;
          summary.offersStored += outcome.stored;
        } else {
          summary.failed++;
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    await this.dispose();

    if (options.runId) await jobsRepo.finishRun(this.db, options.runId);
    return summary;
  }

  private async processJob(job: JobRow): Promise<{ ok: boolean; stored: number }> {
    const log = scoped({ jobId: job.id, source: job.source_code });
    const source = findSource(this.config, job.source_code);

    if (!source) {
      await handleJobFailure(
        job,
        { db: this.db, config: this.config, source: fallbackSource(job.source_code) },
        new Error(`Source "${job.source_code}" is no longer in sources.yaml`),
      );
      return { ok: false, stored: 0 };
    }

    try {
      const collector = await this.collectorFor(source);
      const result = await executeJob(job, {
        db: this.db,
        config: this.config,
        classifier: this.classifier,
        artifacts: this.artifacts,
        collector,
        limiter: this.limiters.get(source.code, source.rateLimit),
        source,
      });
      return { ok: true, stored: result.stored };
    } catch (err) {
      log.error({ err: (err as Error).message }, 'job failed');
      await handleJobFailure(job, { db: this.db, config: this.config, source }, err);
      return { ok: false, stored: 0 };
    }
  }

  /** One collector instance per source, reused across that source's jobs. */
  private async collectorFor(source: SourceConfig): Promise<RentalPriceCollector> {
    const existing = this.collectors.get(source.code);
    if (existing) return existing;

    const collector = createCollector({
      source,
      config: this.config,
      log: scoped({ source: source.code, collector: source.collector }),
      artifacts: this.artifacts,
      dryRun: this.config.env.dryRun,
    });
    await collector.init?.();
    this.collectors.set(source.code, collector);
    return collector;
  }

  private async dispose(): Promise<void> {
    for (const [code, collector] of this.collectors) {
      try {
        await collector.dispose?.();
      } catch (err) {
        logger.warn({ source: code, err: (err as Error).message }, 'collector dispose failed');
      }
    }
    this.collectors.clear();

    const pruned = await this.artifacts.prune(this.config.runner.artifactRetentionDays).catch(() => 0);
    if (pruned > 0) logger.debug({ pruned }, 'pruned old artifact folders');
  }
}

/** Placeholder used only to report a job whose source has vanished from config. */
function fallbackSource(code: string): SourceConfig {
  return {
    code,
    name: code,
    type: 'direct',
    collector: 'missing',
    access: 'browser',
    enabled: false,
    baseUrl: 'https://invalid.invalid',
    locations: {},
    rateLimit: { maxConcurrency: 1, minDelayMs: 0, jitterMs: 0, maxRequestsPerHour: 1 },
    retry: { maxAttempts: 1, backoffMs: 1000, backoffMultiplier: 2, maxBackoffMs: 1000 },
    timeoutMs: 1000,
    options: {},
  };
}
