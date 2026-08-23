import type { AppConfig, SourceConfig } from '../config/types.js';
import type { Db } from '../database/client.js';
import type { JobRow } from '../database/repositories/jobs.js';
import { errorsRepo, jobsRepo, observationsRepo, sourcesRepo } from '../database/repositories/index.js';
import type { SearchQuery, MarketPriceObservation } from '../models/index.js';
import { resolveQueryLocation } from '../models/search-query.js';
import { normalizeOffer, type NormalizeResult } from '../normalizers/offer.js';
import type { VehicleClassifier } from '../normalizers/vehicle-class.js';
import type { RentalPriceCollector } from '../collectors/types.js';
import { CollectionError, toCollectionError } from '../utils/errors.js';
import { backoffFor, withRetry } from '../utils/retry.js';
import type { RateLimiter } from '../utils/rate-limiter.js';
import { scoped } from '../utils/logger.js';
import type { ArtifactStore } from '../utils/artifacts.js';
import { formatLocal } from '../utils/dates.js';

export interface ExecuteDeps {
  db: Db;
  config: AppConfig;
  classifier: VehicleClassifier;
  artifacts: ArtifactStore;
  collector: RentalPriceCollector;
  limiter: RateLimiter;
  source: SourceConfig;
}

export interface ExecuteResult {
  jobId: number;
  offers: number;
  stored: number;
  unresolved: number;
  durationMs: number;
}

/** Rebuild the SearchQuery from a persisted job row. */
export function queryFromJob(job: JobRow, source: SourceConfig, config: AppConfig): SearchQuery {
  const location = config.locations.find((l) => l.code === job.pickup_location_code);
  if (!location) {
    throw new CollectionError({
      stage: 'config',
      retryable: false,
      message: `Job ${job.id} references location "${job.pickup_location_code}" which is not in locations.yaml`,
    });
  }
  const pickup = resolveQueryLocation(source, location);
  if (!pickup) {
    throw new CollectionError({
      stage: 'config',
      retryable: false,
      message: `Source "${source.code}" has no mapping for location "${location.code}"`,
    });
  }
  const dropoffLocation =
    job.return_location_code === job.pickup_location_code
      ? location
      : config.locations.find((l) => l.code === job.return_location_code);
  const dropoff = dropoffLocation ? resolveQueryLocation(source, dropoffLocation) : undefined;
  if (!dropoff) {
    throw new CollectionError({
      stage: 'config',
      retryable: false,
      message: `Source "${source.code}" has no mapping for return location "${job.return_location_code}"`,
    });
  }

  return {
    runId: job.run_id,
    jobId: job.id,
    source,
    pickup,
    dropoff,
    pickupAt: new Date(job.pickup_at),
    returnAt: new Date(job.return_at),
    pickupLocal: formatLocal(new Date(job.pickup_local)),
    returnLocal: formatLocal(new Date(job.return_local)),
    leadTimeDays: job.lead_time_days,
    durationDays: job.duration_days,
    driverAge: job.driver_age ?? config.scenarios.driverAge,
    currency: job.currency ?? config.scenarios.currency,
    observedAt: new Date(),
  };
}

/**
 * Runs one job end to end: search -> normalize -> persist, with the source's
 * rate limit and retry policy applied around the search only.
 *
 * Persistence failures are not retried against the competitor's site — that
 * would be re-collecting data we already hold — they fail the job so it is
 * retried later from the queue.
 */
export async function executeJob(job: JobRow, deps: ExecuteDeps): Promise<ExecuteResult> {
  const { db, config, collector, limiter, source, classifier, artifacts } = deps;
  const log = scoped({ jobId: job.id, runId: job.run_id, source: source.code });
  const startedAt = Date.now();

  const query = queryFromJob(job, source, config);

  const offers = await withRetry(
    async (attempt) => {
      log.debug({ attempt }, 'searching');
      return limiter.run(() => withTimeout(collector.search(query), source.timeoutMs, source.code));
    },
    source.retry,
    log,
    {
      onAttemptFailed: async (error, attempt) => {
        const captured = await captureArtifacts(artifacts, source.code, job.id, collector, error);
        await errorsRepo.recordError(db, {
          jobId: job.id,
          runId: job.run_id,
          sourceCode: source.code,
          error,
          attempt,
          artifacts: captured,
          context: { pickupLocal: query.pickupLocal, durationDays: query.durationDays },
        });
      },
    },
  );

  // ---- normalize -----------------------------------------------------------
  const observations: MarketPriceObservation[] = [];
  const unresolved: NonNullable<NormalizeResult['unresolved']>[] = [];
  for (const offer of offers) {
    try {
      const result = normalizeOffer(query, offer, classifier, collector.version);
      observations.push(result.observation);
      if (result.unresolved) unresolved.push(result.unresolved);
    } catch (err) {
      // one malformed offer must not lose the other 17 in the same search
      const error = toCollectionError(err, 'normalize');
      log.warn({ err: error.message, vehicle: offer.vehicleNameRaw }, 'skipping unnormalizable offer');
      await errorsRepo.recordError(db, {
        jobId: job.id,
        runId: job.run_id,
        sourceCode: source.code,
        error,
        attempt: 1,
        context: { offer: offer.vehicleNameRaw },
      });
    }
  }

  // ---- persist -------------------------------------------------------------
  let stored = 0;
  try {
    stored = await observationsRepo.insertObservations(db, observations);
    if (unresolved.length > 0) await observationsRepo.recordUnresolvedVehicles(db, unresolved);
  } catch (err) {
    throw toCollectionError(err, 'persist');
  }

  const durationMs = Date.now() - startedAt;
  await jobsRepo.completeJob(db, job.id, { offersCollected: stored, durationMs });
  await sourcesRepo.recordSourceSuccess(db, source.code);

  log.info(
    { offers: offers.length, stored, unresolved: unresolved.length, durationMs },
    'job complete',
  );

  return { jobId: job.id, offers: offers.length, stored, unresolved: unresolved.length, durationMs };
}

/** Records a terminal job failure and trips the source circuit breaker. */
export async function handleJobFailure(
  job: JobRow,
  deps: Pick<ExecuteDeps, 'db' | 'config' | 'source'>,
  err: unknown,
): Promise<void> {
  const error = toCollectionError(err);
  const { db, config, source } = deps;
  const log = scoped({ jobId: job.id, source: source.code });

  const retryDelay = backoffFor(source.retry, Math.max(1, job.attempts));
  const outcome = await jobsRepo.failJob(db, job.id, error.message, retryDelay);

  await errorsRepo.recordError(db, {
    jobId: job.id,
    runId: job.run_id,
    sourceCode: source.code,
    error,
    attempt: job.attempts,
  });

  if (outcome.status === 'failed') {
    const health = await sourcesRepo.recordSourceFailure(
      db,
      source.code,
      config.disableAfterConsecutiveFailures,
      error.message.slice(0, 500),
    );
    if (health.autoDisabled) {
      log.error(
        { consecutiveFailures: health.consecutiveFailures },
        'source auto-disabled after repeated failures; needs a human',
      );
    }
  } else {
    log.warn({ retryInMs: retryDelay }, 'job requeued');
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, sourceCode: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new CollectionError({
                stage: 'timeout',
                message: `Search against "${sourceCode}" exceeded ${ms}ms`,
              }),
            ),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Best-effort debug capture. A collector that can produce a screenshot or the
 * page HTML exposes `captureFailureState`; anything that throws in here is
 * swallowed, because failing to debug a failure must not mask the failure.
 */
async function captureArtifacts(
  artifacts: ArtifactStore,
  sourceCode: string,
  jobId: number,
  collector: RentalPriceCollector,
  error: CollectionError,
): Promise<{ screenshotPath?: string; htmlSnapshotPath?: string }> {
  const capturer = collector as RentalPriceCollector & {
    captureFailureState?: () => Promise<{ screenshot?: Buffer; html?: string }>;
  };
  if (typeof capturer.captureFailureState !== 'function') return {};

  try {
    const state = await capturer.captureFailureState();
    const out: { screenshotPath?: string; htmlSnapshotPath?: string } = {};
    if (state.screenshot) {
      out.screenshotPath = await artifacts.writeScreenshot(sourceCode, `job-${jobId}-${error.stage}`, state.screenshot);
    }
    if (state.html) {
      out.htmlSnapshotPath = await artifacts.writeHtml(sourceCode, `job-${jobId}-${error.stage}`, state.html);
    }
    return out;
  } catch {
    return {};
  }
}
