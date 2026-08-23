import { z } from 'zod';

/**
 * Config is validated on load and nowhere else. If a yaml file is wrong the
 * process refuses to start rather than silently collecting garbage.
 */

export const rateLimitSchema = z.object({
  max_concurrency: z.number().int().min(1).max(8).default(1),
  min_delay_ms: z.number().int().min(0).default(6000),
  jitter_ms: z.number().int().min(0).default(2500),
  max_requests_per_hour: z.number().int().min(1).default(120),
});

export const retrySchema = z.object({
  max_attempts: z.number().int().min(1).max(10).default(3),
  backoff_ms: z.number().int().min(100).default(5000),
  backoff_multiplier: z.number().min(1).default(2),
  max_backoff_ms: z.number().int().min(1000).default(120_000),
});

export const locationSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_]+$/, 'location code must be UPPER_SNAKE'),
  name: z.string().min(1),
  iata: z.string().length(3).optional(),
  city: z.string().optional(),
  country: z.string().default('NZ'),
  timezone: z.string().default('Pacific/Auckland'),
  currency: z.string().length(3).default('NZD'),
  enabled: z.boolean().default(true),
});

export const locationsFileSchema = z.object({
  locations: z.array(locationSchema).min(1),
});

/** How one source refers to one of our locations. */
export const sourceLocationSchema = z.object({
  code: z.string().min(1),
  label: z.string().optional(),
  /** free-form extras a specific adapter needs (branch id, terminal, ...) */
  params: z.record(z.unknown()).default({}),
});

export const sourceSchema = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/, 'source code must be lower_snake'),
  name: z.string().min(1),
  type: z.enum(['direct', 'ota']),
  collector: z.string().min(1),
  access: z.enum(['api', 'browser', 'mock']).default('browser'),
  enabled: z.boolean().default(false),
  base_url: z.string().url(),
  search_url: z.string().url().optional(),
  locations: z.record(sourceLocationSchema).default({}),
  rate_limit: rateLimitSchema.partial().optional(),
  retry: retrySchema.partial().optional(),
  timeout_ms: z.number().int().min(1000).optional(),
  /** adapter-specific settings, passed through untouched */
  options: z.record(z.unknown()).default({}),
  notes: z.string().optional(),
});

export const sourcesFileSchema = z.object({
  sources: z.array(sourceSchema).min(1),
});

export const targetWindowSchema = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  locations: z.array(z.string()).min(1),
  pickup_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickup_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  every_n_days: z.number().int().min(1).default(1),
  duration_days: z.array(z.number().int().min(1)).min(1),
  /** restrict to some sources; empty means every enabled source */
  sources: z.array(z.string()).default([]),
  priority: z.number().int().default(50),
});

export const collectionFileSchema = z.object({
  scenarios: z.object({
    lead_time_days: z.array(z.number().int().min(0)).min(1),
    duration_days: z.array(z.number().int().min(1)).min(1),
    pickup_time: z.string().regex(/^\d{2}:\d{2}$/),
    return_time: z.string().regex(/^\d{2}:\d{2}$/),
    one_way: z.boolean().default(false),
    driver_age: z.number().int().min(18).max(99).default(30),
    currency: z.string().length(3).default('NZD'),
  }),
  schedule: z.object({
    daily_run_at: z.string().regex(/^\d{2}:\d{2}$/).default('06:00'),
    timezone: z.string().default('Pacific/Auckland'),
  }),
  defaults: z.object({
    rate_limit: rateLimitSchema,
    retry: retrySchema,
    timeout_ms: z.number().int().min(1000).default(60_000),
    disable_after_consecutive_failures: z.number().int().min(1).default(12),
  }),
  runner: z.object({
    max_concurrency: z.number().int().min(1).max(16).default(2),
    job_lock_timeout_ms: z.number().int().min(60_000).default(900_000),
    artifact_retention_days: z.number().int().min(1).default(14),
  }),
  target_windows: z.array(targetWindowSchema).default([]),
});

export const envSchema = z.object({
  // optional so `doctor` and `probe` work before the database is wired up;
  // getDb() raises a clear error if a command actually needs it
  DATABASE_URL: z.string().default(''),
  LOG_LEVEL: z.string().default('info'),
  ARTIFACTS_DIR: z.string().default('./artifacts'),
  MAX_GLOBAL_CONCURRENCY: z.coerce.number().int().min(1).default(2),
  DRY_RUN: z
    .string()
    .default('0')
    .transform((v) => v === '1' || v.toLowerCase() === 'true'),
});

export type RawRateLimit = z.infer<typeof rateLimitSchema>;
export type RawRetry = z.infer<typeof retrySchema>;
export type RawLocation = z.infer<typeof locationSchema>;
export type RawSource = z.infer<typeof sourceSchema>;
export type RawSourceLocation = z.infer<typeof sourceLocationSchema>;
export type RawTargetWindow = z.infer<typeof targetWindowSchema>;
export type CollectionConfigFile = z.infer<typeof collectionFileSchema>;
export type Env = z.infer<typeof envSchema>;
