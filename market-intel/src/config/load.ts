import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import {
  collectionFileSchema,
  envSchema,
  locationsFileSchema,
  sourcesFileSchema,
  type RawSource,
} from './schema.js';
import type { AppConfig, LocationConfig, SourceConfig, TargetWindow } from './types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(here, '../..');
export const configDir = path.join(packageRoot, 'config');

function readYaml<S extends z.ZodTypeAny>(file: string, schema: S): z.infer<S> {
  if (!existsSync(file)) throw new Error(`Config file not found: ${file}`);
  let parsed: unknown;
  try {
    parsed = parseYaml(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Could not parse YAML in ${path.basename(file)}: ${(err as Error).message}`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid config in ${path.basename(file)}:\n${issues}`);
  }
  return result.data;
}

function mergeSource(raw: RawSource, defaults: ReturnType<typeof collectionFileSchema.parse>['defaults']): SourceConfig {
  const rl = { ...defaults.rate_limit, ...(raw.rate_limit ?? {}) };
  const rt = { ...defaults.retry, ...(raw.retry ?? {}) };
  return {
    code: raw.code,
    name: raw.name,
    type: raw.type,
    collector: raw.collector,
    access: raw.access,
    enabled: raw.enabled,
    baseUrl: raw.base_url,
    searchUrl: raw.search_url,
    locations: raw.locations,
    rateLimit: {
      maxConcurrency: rl.max_concurrency,
      minDelayMs: rl.min_delay_ms,
      jitterMs: rl.jitter_ms,
      maxRequestsPerHour: rl.max_requests_per_hour,
    },
    retry: {
      maxAttempts: rt.max_attempts,
      backoffMs: rt.backoff_ms,
      backoffMultiplier: rt.backoff_multiplier,
      maxBackoffMs: rt.max_backoff_ms,
    },
    timeoutMs: raw.timeout_ms ?? defaults.timeout_ms,
    options: raw.options,
    notes: raw.notes,
  };
}

export interface LoadOptions {
  dir?: string;
  /** skip .env loading (tests) */
  skipDotenv?: boolean;
}

let cached: AppConfig | undefined;

export function loadConfig(options: LoadOptions = {}): AppConfig {
  const dir = options.dir ?? configDir;
  if (!options.skipDotenv) loadDotenv({ path: path.join(packageRoot, '.env'), quiet: true });

  const files = {
    sources: path.join(dir, 'sources.yaml'),
    locations: path.join(dir, 'locations.yaml'),
    collection: path.join(dir, 'collection.yaml'),
  };

  const sourcesFile = readYaml(files.sources, sourcesFileSchema);
  const locationsFile = readYaml(files.locations, locationsFileSchema);
  const collection = readYaml(files.collection, collectionFileSchema);

  const envResult = envSchema.safeParse(process.env);
  if (!envResult.success) {
    const issues = envResult.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment (copy .env.example to .env):\n${issues}`);
  }
  const env = envResult.data;

  const locations: LocationConfig[] = locationsFile.locations.map((l) => ({
    code: l.code,
    name: l.name,
    iata: l.iata,
    city: l.city,
    country: l.country,
    timezone: l.timezone,
    currency: l.currency,
    enabled: l.enabled,
  }));

  const sources = sourcesFile.sources.map((s) => mergeSource(s, collection.defaults));

  assertConsistent(sources, locations, collection.target_windows);

  return {
    env: {
      databaseUrl: env.DATABASE_URL,
      logLevel: env.LOG_LEVEL,
      artifactsDir: path.isAbsolute(env.ARTIFACTS_DIR)
        ? env.ARTIFACTS_DIR
        : path.join(packageRoot, env.ARTIFACTS_DIR),
      maxGlobalConcurrency: env.MAX_GLOBAL_CONCURRENCY,
      dryRun: env.DRY_RUN,
    },
    scenarios: {
      leadTimeDays: [...collection.scenarios.lead_time_days].sort((a, b) => a - b),
      durationDays: [...collection.scenarios.duration_days].sort((a, b) => a - b),
      pickupTime: collection.scenarios.pickup_time,
      returnTime: collection.scenarios.return_time,
      oneWay: collection.scenarios.one_way,
      driverAge: collection.scenarios.driver_age,
      currency: collection.scenarios.currency,
    },
    schedule: {
      dailyRunAt: collection.schedule.daily_run_at,
      timezone: collection.schedule.timezone,
    },
    runner: {
      maxConcurrency: Math.min(collection.runner.max_concurrency, env.MAX_GLOBAL_CONCURRENCY),
      jobLockTimeoutMs: collection.runner.job_lock_timeout_ms,
      artifactRetentionDays: collection.runner.artifact_retention_days,
    },
    disableAfterConsecutiveFailures: collection.defaults.disable_after_consecutive_failures,
    sources,
    locations,
    targetWindows: collection.target_windows.map((w) => ({
      code: w.code,
      description: w.description,
      enabled: w.enabled,
      locations: w.locations,
      pickupFrom: w.pickup_from,
      pickupTo: w.pickup_to,
      everyNDays: w.every_n_days,
      durationDays: [...w.duration_days].sort((a, b) => a - b),
      sources: w.sources,
      priority: w.priority,
    })),
    files,
  };
}

/** Cross-file checks that neither schema can express on its own. */
function assertConsistent(
  sources: SourceConfig[],
  locations: LocationConfig[],
  targetWindows: Array<{ code: string; locations: string[]; sources: string[]; pickup_from: string; pickup_to: string }>,
): void {
  const problems: string[] = [];
  const locationCodes = new Set(locations.map((l) => l.code));

  const seen = new Set<string>();
  for (const s of sources) {
    if (seen.has(s.code)) problems.push(`duplicate source code "${s.code}"`);
    seen.add(s.code);

    for (const code of Object.keys(s.locations)) {
      if (!locationCodes.has(code)) {
        problems.push(`source "${s.code}" references unknown location "${code}"`);
      }
    }
    const enabledHere = Object.keys(s.locations).filter((c) => locationCodes.has(c));
    if (s.enabled && enabledHere.length === 0) {
      problems.push(`source "${s.code}" is enabled but has no locations configured`);
    }
  }

  const seenLocations = new Set<string>();
  for (const l of locations) {
    if (seenLocations.has(l.code)) problems.push(`duplicate location code "${l.code}"`);
    seenLocations.add(l.code);
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: l.timezone });
    } catch {
      problems.push(`location "${l.code}" has an invalid timezone "${l.timezone}"`);
    }
  }

  const sourceCodes = new Set(sources.map((s) => s.code));
  for (const w of targetWindows) {
    for (const code of w.locations) {
      if (!locationCodes.has(code)) problems.push(`target window "${w.code}" references unknown location "${code}"`);
    }
    for (const code of w.sources) {
      if (!sourceCodes.has(code)) problems.push(`target window "${w.code}" references unknown source "${code}"`);
    }
    if (Date.parse(w.pickup_to) < Date.parse(w.pickup_from)) {
      problems.push(`target window "${w.code}" ends (${w.pickup_to}) before it starts (${w.pickup_from})`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Config is inconsistent:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
}

/** Process-wide singleton, for code paths that should not re-read the files. */
export function getConfig(options: LoadOptions = {}): AppConfig {
  cached ??= loadConfig(options);
  return cached;
}

export function resetConfigCache(): void {
  cached = undefined;
}
