import { describe, expect, it, beforeAll } from 'vitest';
import { loadConfig } from '../src/config/load.js';
import type { AppConfig } from '../src/config/types.js';
import { planJobs } from '../src/jobs/generate.js';

let config: AppConfig;

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://localhost:5432/unused_in_this_test';
  const loaded = loadConfig({ skipDotenv: true });
  // the mock sources are disabled in production config; the planner tests are
  // about the grid, so enable every source here
  config = { ...loaded, sources: loaded.sources.map((s) => ({ ...s, enabled: true })) };
});

describe('planJobs', () => {
  const NOW = new Date('2026-08-23T22:00:00Z'); // 2026-08-24 10:00 in Christchurch

  const rollingOnly = (): AppConfig => ({ ...config, targetWindows: [] });

  it('produces lead times x durations for every enabled source/market pair', () => {
    const plan = planJobs(rollingOnly(), { now: NOW });
    const pairs = config.sources
      .filter((s) => s.enabled)
      .reduce((acc, s) => acc + config.locations.filter((l) => l.enabled && s.locations[l.code]).length, 0);

    const expected = pairs * config.scenarios.leadTimeDays.length * config.scenarios.durationDays.length;
    expect(plan.jobs.length).toBe(expected);
  });

  it('adds target-window jobs on top of the rolling grid', () => {
    const withWindows = planJobs(config, { now: NOW });
    const withoutWindows = planJobs(rollingOnly(), { now: NOW });
    expect(withWindows.jobs.length).toBeGreaterThan(withoutWindows.jobs.length);
    expect(new Set(withWindows.jobs.map((j) => j.dedupeKey)).size).toBe(withWindows.jobs.length);
  });

  it('gives every job a unique dedupe key so re-planning is idempotent', () => {
    const plan = planJobs(config, { now: NOW });
    expect(new Set(plan.jobs.map((j) => j.dedupeKey)).size).toBe(plan.jobs.length);
  });

  it('produces the same dedupe keys for the same day and different ones tomorrow', () => {
    const today = planJobs(config, { now: NOW });
    const laterToday = planJobs(config, { now: new Date('2026-08-23T23:30:00Z') });
    const tomorrow = planJobs(config, { now: new Date('2026-08-24T22:00:00Z') });

    expect(new Set(laterToday.jobs.map((j) => j.dedupeKey))).toEqual(new Set(today.jobs.map((j) => j.dedupeKey)));
    const overlap = today.jobs.filter((j) => tomorrow.jobs.some((t) => t.dedupeKey === j.dedupeKey));
    expect(overlap).toHaveLength(0);
  });

  it('places pickup at the configured lead time, in local time', () => {
    const plan = planJobs(rollingOnly(), { now: NOW, sourceCodes: ['mock_direct'] });
    const sevenDay = plan.jobs.filter((j) => j.leadTimeDays === 7);
    expect(sevenDay.length).toBe(config.scenarios.durationDays.length);
    for (const job of sevenDay) {
      expect(job.pickupLocal).toBe('2026-08-31 10:00:00');
    }
  });

  it('sets the return date from the rental duration', () => {
    const plan = planJobs(rollingOnly(), { now: NOW, sourceCodes: ['mock_direct'] });
    const job = plan.jobs.find((j) => j.leadTimeDays === 7 && j.durationDays === 5);
    expect(job?.returnLocal).toBe('2026-09-05 10:00:00');
    expect(job?.pickupLocationCode).toBe(job?.returnLocationCode);
  });

  it('prioritises short lead times, whose prices move fastest', () => {
    const plan = planJobs(config, { now: NOW });
    const oneDay = plan.jobs.find((j) => j.leadTimeDays === 1);
    const ninetyDay = plan.jobs.find((j) => j.leadTimeDays === 90);
    expect(oneDay!.priority).toBeLessThan(ninetyDay!.priority);
  });

  it('reports source/market pairs it skipped instead of silently dropping them', () => {
    const plan = planJobs(config, { now: NOW, locationCodes: ['CHC_APT'] });
    expect(plan.skipped.every((s) => s.reason.length > 0)).toBe(true);
  });
});
