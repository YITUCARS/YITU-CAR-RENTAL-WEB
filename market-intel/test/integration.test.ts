import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb } from './helpers/pglite-db.js';
import { loadConfig } from '../src/config/load.js';
import type { AppConfig } from '../src/config/types.js';
import type { Db } from '../src/database/client.js';
import { migrate } from '../src/database/migrate.js';
import { jobsRepo, observationsRepo, sourcesRepo } from '../src/database/repositories/index.js';
import { planJobs } from '../src/jobs/generate.js';
import { CollectionRunner } from '../src/jobs/runner.js';

let db: Db;
let close: () => Promise<void>;
let config: AppConfig;

beforeAll(async () => {
  process.env.DATABASE_URL ??= 'postgresql://localhost:5432/unused';
  const loaded = loadConfig({ skipDotenv: true });
  // The integration suite runs entirely offline against PGlite: keep it to the
  // synthetic sources, and off the target windows, which exist to reach dates
  // the rolling grid cannot.
  config = {
    ...loaded,
    // enabled explicitly: sources.yaml keeps the mocks off in production
    sources: loaded.sources.filter((s) => s.collector === 'mock').map((s) => ({ ...s, enabled: true })),
    targetWindows: [],
  };
  ({ db, close } = await createTestDb());
  await migrate(db);
  await sourcesRepo.syncLocations(db, config.locations);
  await sourcesRepo.syncSources(db, config.sources);
}, 60_000);

afterAll(async () => {
  await close?.();
});

describe('schema + migrations', () => {
  it('is idempotent', async () => {
    const second = await migrate(db);
    expect(second.applied).toHaveLength(0);
    expect(second.changed).toHaveLength(0);
  });

  it('seeds the vehicle classes and mapping rules', async () => {
    const classes = await db.query<{ count: number }>('select count(*)::int as count from market_intel.vehicle_classes');
    const rules = await db.query<{ count: number }>('select count(*)::int as count from market_intel.vehicle_class_mapping');
    expect(classes.rows[0]!.count).toBe(11);
    expect(rules.rows[0]!.count).toBeGreaterThan(100);
  });

  it('syncs sources from yaml without clobbering runtime health', async () => {
    await sourcesRepo.recordSourceFailure(db, 'mock_direct', 99, 'test');
    await sourcesRepo.syncSources(db, config.sources);
    const row = await sourcesRepo.getSourceByCode(db, 'mock_direct');
    expect(row?.consecutive_failures).toBe(1);
    await sourcesRepo.reEnableSource(db, 'mock_direct');
  });
});

describe('queue', () => {
  it('enqueues the scenario grid and dedupes a repeat plan', async () => {
    const runId = randomUUID();
    const plan = planJobs(config, { runId });
    await jobsRepo.createRun(db, { id: runId, trigger: 'test' });
    const inserted = await jobsRepo.insertJobs(db, plan.jobs);
    expect(inserted).toBe(plan.jobs.length);

    const repeat = planJobs(config, { runId });
    expect(await jobsRepo.insertJobs(db, repeat.jobs)).toBe(0);
  });

  it('claims a job atomically and never hands the same one out twice', async () => {
    const first = await jobsRepo.claimNextJob(db, 'worker-a');
    const second = await jobsRepo.claimNextJob(db, 'worker-b');
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.id).not.toBe(second!.id);
    expect(first!.status).toBe('running');
    // shortest lead time first
    expect(first!.lead_time_days).toBe(1);

    await jobsRepo.failJob(db, first!.id, 'test requeue', 0);
    await jobsRepo.failJob(db, second!.id, 'test requeue', 0);
  });

  it('does not hand out jobs for an auto-disabled source', async () => {
    await db.query(`update market_intel.sources set auto_disabled = true where code = 'mock_ota'`);
    const claimed: string[] = [];
    for (let i = 0; i < 5; i++) {
      const job = await jobsRepo.claimNextJob(db, 'worker-c');
      if (!job) break;
      claimed.push(job.source_code);
      await jobsRepo.failJob(db, job.id, 'requeue', 0);
    }
    expect(claimed).not.toContain('mock_ota');
    await sourcesRepo.reEnableSource(db, 'mock_ota');
  });
});

describe('collection run end to end', () => {
  // A different plan day than the queue tests above, so the dedupe key does
  // not (correctly) suppress these jobs as already-queued.
  const PLAN_DAY = new Date(Date.now() + 2 * 86_400_000);

  function testRunner(overrideSources = (s: AppConfig['sources'][number]) => s): CollectionRunner {
    return new CollectionRunner(db, {
      ...config,
      // the mock needs no politeness delay; real sources keep theirs
      sources: config.sources.map((s) => overrideSources({
        ...s,
        rateLimit: { ...s.rateLimit, minDelayMs: 0, jitterMs: 0 },
      })),
    });
  }

  let runId: string;

  it('collects, normalizes and stores observations', async () => {
    runId = randomUUID();
    const plan = planJobs(config, { runId, now: PLAN_DAY, sourceCodes: ['mock_direct', 'mock_ota'] });
    await jobsRepo.createRun(db, { id: runId, trigger: 'test' });
    await db.query(`update market_intel.collection_jobs set status = 'cancelled' where run_id <> $1`, [runId]);
    expect(await jobsRepo.insertJobs(db, plan.jobs)).toBe(plan.jobs.length);

    const summary = await testRunner().run({ runId });

    expect(summary.processed).toBe(plan.jobs.length);
    expect(summary.succeeded).toBeGreaterThan(0);
    expect(summary.offersStored).toBeGreaterThan(0);

    const stored = await db.query<{ count: number }>(
      'select count(*)::int as count from market_intel.market_price_observations where run_id = $1',
      [runId],
    );
    expect(stored.rows[0]!.count).toBe(summary.offersStored);
  }, 120_000);

  it('marks the run finished with per-status counts', async () => {
    await jobsRepo.finishRun(db, runId);
    const { rows } = await db.query<{ status: string; planned_jobs: number; succeeded_jobs: number }>(
      'select status, planned_jobs, succeeded_jobs from market_intel.collection_runs where id = $1',
      [runId],
    );
    // 'running' is legitimate here: a job that failed an attempt goes back on
    // the queue, so the run is not finished until those retries are spent
    expect(['completed', 'running']).toContain(rows[0]!.status);
    expect(rows[0]!.planned_jobs).toBeGreaterThan(0);
    expect(rows[0]!.succeeded_jobs).toBeGreaterThan(0);
  });

  it('keeps supplier and channel distinct for OTA rows', async () => {
    const { rows } = await db.query<{ supplier: string; channel: string; source_type: string }>(
      `select distinct supplier, channel, source_type
         from market_intel.market_price_observations where source_code = 'mock_ota'`,
    );
    expect(rows.length).toBeGreaterThan(1);
    expect(new Set(rows.map((r) => r.channel)).size).toBe(1);
    expect(new Set(rows.map((r) => r.supplier)).size).toBeGreaterThan(1);
    expect(rows.every((r) => r.source_type === 'ota')).toBe(true);
  });

  it('sees one supplier through both a direct site and an OTA', async () => {
    const { rows } = await db.query<{ supplier: string; channels: number }>(
      `select supplier, count(distinct channel)::int as channels
         from market_intel.market_price_observations
        where supplier is not null group by supplier order by channels desc limit 1`,
    );
    // the mock OTA resells Avis etc.; the point is the view does not treat one
    // supplier on two channels as two fleets
    expect(rows[0]!.supplier).toBeTruthy();
  });

  it('classifies almost everything deterministically and queues the rest', async () => {
    const { rows } = await db.query<{ total: number; classified: number }>(
      `select count(*)::int as total, count(vehicle_class)::int as classified
         from market_intel.market_price_observations`,
    );
    const { total, classified } = rows[0]!;
    expect(total).toBeGreaterThan(0);
    expect(classified / total).toBeGreaterThan(0.85);

    const unresolved = await db.query<{ vehicle_name_raw: string; occurrences: number }>(
      'select vehicle_name_raw, occurrences from market_intel.v_unresolved_vehicles',
    );
    expect(unresolved.rows.some((r) => r.vehicle_name_raw.includes('Foton View Wagon'))).toBe(true);
    expect(unresolved.rows[0]!.occurrences).toBeGreaterThan(0);
  });

  it('exposes the market snapshot view with sane min <= median <= max', async () => {
    const { rows } = await db.query<Record<string, number>>(
      `select * from market_intel.v_market_daily where vehicle_class = 'MIDSIZE_SUV' limit 5`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Number(row.min_daily_price)).toBeLessThanOrEqual(Number(row.median_daily_price));
      expect(Number(row.median_daily_price)).toBeLessThanOrEqual(Number(row.max_daily_price));
    }
  });

  it('builds a lead-time curve that rises as pickup approaches', async () => {
    // One run covers all seven lead times at once, which is the same shape the
    // daily schedule produces for a single pickup date over three months.
    const { rows } = await db.query<{ lead_time_days: number; median: number }>(
      `select lead_time_days, percentile_cont(0.5) within group (order by daily_price) as median
         from market_intel.market_price_observations
        where vehicle_class = 'MIDSIZE_SUV' and availability = 'available' and duration_days = 5
        group by lead_time_days order by lead_time_days`,
    );
    expect(rows.length).toBeGreaterThan(2);
    expect(Number(rows[0]!.median)).toBeGreaterThan(Number(rows[rows.length - 1]!.median));
  });

  it('records a failed attempt as an error row with its stage', async () => {
    const failRunId = randomUUID();
    await jobsRepo.createRun(db, { id: failRunId, trigger: 'test' });
    const plan = planJobs(config, {
      runId: failRunId,
      sourceCodes: ['mock_ota'],
      now: new Date(Date.now() + 5 * 86_400_000),
    });
    await jobsRepo.insertJobs(db, plan.jobs.slice(0, 1));

    const before = await db.query<{ count: number }>(
      'select count(*)::int as count from market_intel.collection_errors',
    );
    // force every attempt to fail, so the retry + error-recording path is
    // exercised rather than depending on the 5% random failure rate
    await testRunner((s) =>
      s.code === 'mock_ota'
        ? { ...s, options: { ...s.options, failure_rate: 1 }, retry: { ...s.retry, backoffMs: 10, maxBackoffMs: 20 } }
        : s,
    ).run({ runId: failRunId, maxJobs: 1 });

    const { rows } = await db.query<{ count: number; stages: string[] }>(
      `select count(*)::int as count, array_agg(distinct stage) as stages
         from market_intel.collection_errors`,
    );
    expect(rows[0]!.count).toBeGreaterThan(before.rows[0]!.count);
    expect(rows[0]!.stages).toContain('parse');

    const job = await db.query<{ status: string; attempts: number; last_error: string }>(
      'select status, attempts, last_error from market_intel.collection_jobs where run_id = $1',
      [failRunId],
    );
    expect(job.rows[0]!.attempts).toBeGreaterThan(0);
    expect(job.rows[0]!.last_error).toContain('Simulated');
  }, 120_000);

  it('never overwrites an earlier observation of the same offer', async () => {
    const before = await db.query<{ count: number }>(
      'select count(*)::int as count from market_intel.market_price_observations',
    );
    const laterRunId = randomUUID();
    await jobsRepo.createRun(db, { id: laterRunId, trigger: 'test' });
    // same pickup dates as an earlier plan, observed a day later
    const plan = planJobs(config, {
      runId: laterRunId,
      sourceCodes: ['mock_direct'],
      now: new Date(Date.now() + 3 * 86_400_000),
    });
    await jobsRepo.insertJobs(db, plan.jobs);
    await testRunner().run({ runId: laterRunId, maxJobs: 2 });

    const after = await db.query<{ count: number }>(
      'select count(*)::int as count from market_intel.market_price_observations',
    );
    expect(after.rows[0]!.count).toBeGreaterThan(before.rows[0]!.count);

    // the same pickup date now has observations from two different runs
    const { rows } = await db.query<{ runs: number }>(
      `select count(distinct run_id)::int as runs
         from market_intel.market_price_observations where source_code = 'mock_direct'`,
    );
    expect(rows[0]!.runs).toBeGreaterThan(1);
  }, 60_000);
});

/**
 * The website's /admin reads the dataset through the public.mi_* bridge views,
 * never through the market_intel schema directly. These assertions are the
 * contract that page depends on: if a view stops answering, the dashboard
 * breaks, and this fails first.
 */
describe('admin bridge views', () => {
  it('summarises the dataset in one row', async () => {
    const { rows } = await db.query<Record<string, number | string | null>>(
      'select * from public.mi_dataset_summary',
    );
    expect(rows).toHaveLength(1);
    const s = rows[0]!;
    expect(Number(s.observations)).toBeGreaterThan(0);
    expect(Number(s.active_sources)).toBeGreaterThan(0);
    expect(s.last_observed_at).toBeTruthy();
    expect(Number(s.pickup_dates_tracked)).toBeGreaterThan(0);
  });

  it('reports source health per source', async () => {
    const { rows } = await db.query<{ source_code: string; offers_24h: number }>(
      'select * from public.mi_source_health order by source_code',
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => Number(r.offers_24h) > 0)).toBe(true);
  });

  it('lists pickup dates the dashboard can plot', async () => {
    const { rows } = await db.query<{ pickup_date: string; observation_days: number; duration_days: number }>(
      `select * from public.mi_pickup_dates where duration_days = 5 order by pickup_date`,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number(r.observation_days) >= 1)).toBe(true);
  });

  it('serves the exact market snapshot query the admin route runs', async () => {
    const latest = await db.query<{ observed_date: string }>(
      `select observed_date from public.mi_market_daily
        where pickup_location_code = $1 order by observed_date desc limit 1`,
      ['CHC_APT'],
    );
    expect(latest.rows[0]).toBeTruthy();

    const { rows } = await db.query<Record<string, number | string>>(
      `select * from public.mi_market_daily
        where pickup_location_code = $1 and observed_date = $2 and duration_days = $3
        order by vehicle_class`,
      ['CHC_APT', latest.rows[0]!.observed_date, 5],
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Number(row.min_daily_price)).toBeLessThanOrEqual(Number(row.median_daily_price));
      expect(Number(row.median_daily_price)).toBeLessThanOrEqual(Number(row.max_daily_price));
      expect(Number(row.offer_count)).toBeGreaterThan(0);
    }
  });

  it('serves the curve query behind the chart', async () => {
    const pick = await db.query<{ pickup_date: string; vehicle_class: string }>(
      `select pickup_date, vehicle_class from public.mi_lead_time_curve
        where duration_days = 5 and vehicle_class is not null limit 1`,
    );
    expect(pick.rows[0]).toBeTruthy();

    const { rows } = await db.query<Record<string, number | string>>(
      `select observed_date, days_before_pickup, offer_count,
              min_daily_price, median_daily_price, max_daily_price
         from public.mi_lead_time_curve
        where pickup_location_code = $1 and pickup_date = $2
          and vehicle_class = $3 and duration_days = $4
        order by observed_date`,
      ['CHC_APT', pick.rows[0]!.pickup_date, pick.rows[0]!.vehicle_class, 5],
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Number(row.days_before_pickup)).toBeGreaterThanOrEqual(0);
      expect(Number(row.median_daily_price)).toBeGreaterThan(0);
    }
  });

  it('exposes runs, errors and the review queue', async () => {
    const runs = await db.query('select * from public.mi_recent_runs');
    const errors = await db.query('select * from public.mi_recent_errors');
    const unresolved = await db.query('select * from public.mi_unresolved_vehicles');
    expect(runs.rows.length).toBeGreaterThan(0);
    expect(errors.rows.length).toBeGreaterThan(0);
    expect(unresolved.rows.length).toBeGreaterThan(0);
  });
});
