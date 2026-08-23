import { randomUUID } from 'node:crypto';
import type { AppConfig, LocationConfig, SourceConfig, TargetWindow } from '../config/types.js';
import { enabledLocations, enabledSources } from '../config/types.js';
import type { NewJob } from '../database/repositories/jobs.js';
import { addLocalDays, atLocalTime, formatLocal, formatLocalDate, leadTimeDays, localToday } from '../utils/dates.js';
import { shortHash } from '../utils/hash.js';

export interface PlanOptions {
  /** defaults to a fresh uuid */
  runId?: string;
  /** restrict to these source codes */
  sourceCodes?: string[];
  /** restrict to these location codes */
  locationCodes?: string[];
  /** treat this as "today" (backfills, tests) */
  now?: Date;
}

export interface Plan {
  runId: string;
  jobs: NewJob[];
  /** why a source/location pair produced nothing, for the CLI to report */
  skipped: Array<{ sourceCode: string; locationCode: string; reason: string }>;
}

/**
 * The scenario grid: every enabled source x every location it supports x every
 * lead time x every rental duration.
 *
 * The lead times are what make the dataset a time series rather than a
 * snapshot. Run daily, they mean one pickup date is quoted repeatedly as it
 * approaches: a 2026-11-20 pickup is first seen at 90 days out, then at 60, 30,
 * 14, 7, 3 and 1 — which is exactly the curve we want to model.
 */
export function planJobs(config: AppConfig, options: PlanOptions = {}): Plan {
  const runId = options.runId ?? randomUUID();
  const now = options.now ?? new Date();
  const { scenarios } = config;

  const sources = enabledSources(config).filter(
    (s) => !options.sourceCodes || options.sourceCodes.includes(s.code),
  );
  const locations = enabledLocations(config).filter(
    (l) => !options.locationCodes || options.locationCodes.includes(l.code),
  );

  const jobs: NewJob[] = [];
  const skipped: Plan['skipped'] = [];

  for (const source of sources) {
    for (const location of locations) {
      if (!source.locations[location.code]) {
        skipped.push({
          sourceCode: source.code,
          locationCode: location.code,
          reason: 'source has no location mapping for this market',
        });
        continue;
      }
      jobs.push(...jobsForPair(config, source, location, runId, now));
      jobs.push(...targetWindowJobs(config, source, location, runId, now, skipped));
    }
  }

  // the rolling grid and a target window can land on the same pickup date;
  // the dedupe key would reject the second insert anyway, so drop it here and
  // keep the plan count honest
  const seen = new Set<string>();
  const deduped = jobs.filter((job) => {
    if (seen.has(job.dedupeKey)) return false;
    seen.add(job.dedupeKey);
    return true;
  });

  return { runId, jobs: deduped, skipped };
}

function jobsForPair(
  config: AppConfig,
  source: SourceConfig,
  location: LocationConfig,
  runId: string,
  now: Date,
): NewJob[] {
  const { scenarios } = config;
  const today = localToday(location.timezone, now);
  // The plan date is part of the dedupe key, so re-running the planner on the
  // same day is a no-op while tomorrow's run legitimately re-observes the same
  // pickup dates.
  const planDate = formatLocal(today).slice(0, 10);

  const jobs: NewJob[] = [];

  for (const leadTime of scenarios.leadTimeDays) {
    const pickupDate = addLocalDays(today, leadTime);
    const pickup = atLocalTime(pickupDate, scenarios.pickupTime, location.timezone);

    for (const duration of scenarios.durationDays) {
      const returnDate = addLocalDays(pickupDate, duration);
      const dropoff = atLocalTime(returnDate, scenarios.returnTime, location.timezone);

      jobs.push({
        runId,
        sourceCode: source.code,
        pickupLocationCode: location.code,
        returnLocationCode: location.code, // one-way is off; see scenarios.one_way
        pickupAt: pickup.utc,
        returnAt: dropoff.utc,
        pickupLocal: pickup.local,
        returnLocal: dropoff.local,
        leadTimeDays: leadTime,
        durationDays: duration,
        driverAge: scenarios.driverAge,
        currency: location.currency || scenarios.currency,
        maxAttempts: source.retry.maxAttempts,
        // shorter lead times first: those prices move fastest and are the ones
        // we least want to miss if a run is cut short
        priority: leadTime,
        dedupeKey: shortHash(planDate, source.code, location.code, pickup.local, dropoff.local),
      });
    }
  }

  return jobs;
}

/**
 * Jobs for the named target windows (e.g. "February 2027").
 *
 * The rolling grid only reaches 90 days out, so a peak month we need to price
 * would not be observed at all until it entered that window. These jobs pin
 * specific pickup dates instead, and because they are regenerated on every
 * run, the same February date accumulates observations from however far out we
 * started right up to the day itself — a complete booking curve rather than
 * the last 90 days of one.
 */
function targetWindowJobs(
  config: AppConfig,
  source: SourceConfig,
  location: LocationConfig,
  runId: string,
  now: Date,
  skipped: Plan['skipped'],
): NewJob[] {
  const jobs: NewJob[] = [];
  const today = localToday(location.timezone, now);
  const planDate = formatLocalDate(today);

  for (const window of config.targetWindows) {
    if (!window.enabled) continue;
    if (!window.locations.includes(location.code)) continue;
    if (window.sources.length > 0 && !window.sources.includes(source.code)) continue;

    for (const pickupDate of windowPickupDates(window)) {
      // a window whose dates have passed is silently done, not an error
      const lead = leadTimeDays(now, atLocalTime(pickupDate, config.scenarios.pickupTime, location.timezone).utc, location.timezone);
      if (lead < 0) continue;

      const pickup = atLocalTime(pickupDate, config.scenarios.pickupTime, location.timezone);

      for (const duration of window.durationDays) {
        const dropoff = atLocalTime(
          addLocalDays(pickupDate, duration),
          config.scenarios.returnTime,
          location.timezone,
        );
        jobs.push({
          runId,
          sourceCode: source.code,
          pickupLocationCode: location.code,
          returnLocationCode: location.code,
          pickupAt: pickup.utc,
          returnAt: dropoff.utc,
          pickupLocal: pickup.local,
          returnLocal: dropoff.local,
          leadTimeDays: lead,
          durationDays: duration,
          driverAge: config.scenarios.driverAge,
          currency: location.currency || config.scenarios.currency,
          maxAttempts: source.retry.maxAttempts,
          priority: window.priority,
          dedupeKey: shortHash(planDate, source.code, location.code, pickup.local, dropoff.local),
        });
      }
    }

    if (jobs.length === 0) {
      skipped.push({
        sourceCode: source.code,
        locationCode: location.code,
        reason: `target window "${window.code}" has no future pickup dates left`,
      });
    }
  }

  return jobs;
}

/** Every nth calendar date between the window's bounds, inclusive. */
export function windowPickupDates(window: TargetWindow): Date[] {
  const dates: Date[] = [];
  const start = new Date(`${window.pickupFrom}T00:00:00`);
  const end = new Date(`${window.pickupTo}T00:00:00`);
  for (let d = start; d <= end; d = addLocalDays(d, window.everyNDays)) {
    dates.push(d);
  }
  return dates;
}

/** Human-readable summary for `jobs:plan`. */
export function describePlan(plan: Plan): string {
  const bySource = new Map<string, number>();
  for (const job of plan.jobs) {
    bySource.set(job.sourceCode, (bySource.get(job.sourceCode) ?? 0) + 1);
  }
  const lines = [...bySource.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, count]) => `  ${code.padEnd(24)} ${count} jobs`);
  return [`run ${plan.runId}`, `${plan.jobs.length} jobs total`, ...lines].join('\n');
}
