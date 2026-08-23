import type { RateLimitConfig } from '../utils/rate-limiter.js';
import type { RetryPolicy } from '../utils/retry.js';
import type { RawSourceLocation } from './schema.js';

export interface LocationConfig {
  code: string;
  name: string;
  iata?: string;
  city?: string;
  country: string;
  timezone: string;
  currency: string;
  enabled: boolean;
}

/** A source with defaults already merged in — adapters never see raw yaml. */
export interface SourceConfig {
  code: string;
  name: string;
  type: 'direct' | 'ota';
  collector: string;
  access: 'api' | 'browser' | 'mock';
  enabled: boolean;
  baseUrl: string;
  searchUrl?: string;
  locations: Record<string, RawSourceLocation>;
  rateLimit: RateLimitConfig;
  retry: RetryPolicy;
  timeoutMs: number;
  options: Record<string, unknown>;
  notes?: string;
}

export interface ScenarioConfig {
  leadTimeDays: number[];
  durationDays: number[];
  pickupTime: string;
  returnTime: string;
  oneWay: boolean;
  driverAge: number;
  currency: string;
}

export interface TargetWindow {
  code: string;
  description?: string;
  enabled: boolean;
  locations: string[];
  pickupFrom: string;
  pickupTo: string;
  everyNDays: number;
  durationDays: number[];
  sources: string[];
  priority: number;
}

export interface RunnerConfig {
  maxConcurrency: number;
  jobLockTimeoutMs: number;
  artifactRetentionDays: number;
}

export interface AppConfig {
  env: {
    databaseUrl: string;
    logLevel: string;
    artifactsDir: string;
    maxGlobalConcurrency: number;
    dryRun: boolean;
  };
  scenarios: ScenarioConfig;
  schedule: { dailyRunAt: string; timezone: string };
  runner: RunnerConfig;
  disableAfterConsecutiveFailures: number;
  sources: SourceConfig[];
  locations: LocationConfig[];
  targetWindows: TargetWindow[];
  /** absolute paths, for logging what was actually loaded */
  files: { sources: string; locations: string; collection: string };
}

export function enabledSources(config: AppConfig): SourceConfig[] {
  return config.sources.filter((s) => s.enabled);
}

export function enabledLocations(config: AppConfig): LocationConfig[] {
  return config.locations.filter((l) => l.enabled);
}

export function findLocation(config: AppConfig, code: string): LocationConfig | undefined {
  return config.locations.find((l) => l.code === code);
}

export function findSource(config: AppConfig, code: string): SourceConfig | undefined {
  return config.sources.find((s) => s.code === code);
}
