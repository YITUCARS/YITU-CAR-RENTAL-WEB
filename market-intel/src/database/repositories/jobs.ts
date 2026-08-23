import type { Db, DbClient } from '../client.js';

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';

export interface JobRow {
  id: number;
  run_id: string;
  source_id: number | null;
  source_code: string;
  pickup_location_code: string;
  return_location_code: string;
  pickup_at: Date;
  return_at: Date;
  pickup_local: Date;
  return_local: Date;
  lead_time_days: number;
  duration_days: number;
  driver_age: number | null;
  currency: string | null;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  priority: number;
  dedupe_key: string;
}

export interface NewJob {
  runId: string;
  sourceId?: number;
  sourceCode: string;
  pickupLocationCode: string;
  returnLocationCode: string;
  pickupAt: Date;
  returnAt: Date;
  pickupLocal: string;
  returnLocal: string;
  leadTimeDays: number;
  durationDays: number;
  driverAge: number;
  currency: string;
  maxAttempts: number;
  priority: number;
  dedupeKey: string;
}

export async function createRun(
  db: Db,
  run: { id: string; label?: string; trigger?: string; configSnapshot?: unknown },
): Promise<void> {
  await db.query(
    `insert into market_intel.collection_runs (id, label, trigger, config_snapshot)
     values ($1,$2,$3,$4)`,
    [run.id, run.label ?? null, run.trigger ?? 'manual', run.configSnapshot ?? {}],
  );
}

/**
 * Bulk insert. `on conflict (dedupe_key) do nothing` makes planning idempotent:
 * re-running the planner for the same day never produces duplicate work.
 */
export async function insertJobs(db: Db, jobs: NewJob[]): Promise<number> {
  if (jobs.length === 0) return 0;

  const columns = 11 + 5;
  const values: unknown[] = [];
  const tuples: string[] = [];

  jobs.forEach((j, i) => {
    const base = i * columns;
    tuples.push(
      `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},` +
        `$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},` +
        `$${base + 14},$${base + 15},$${base + 16})`,
    );
    values.push(
      j.runId, j.sourceId ?? null, j.sourceCode,
      j.pickupLocationCode, j.returnLocationCode,
      j.pickupAt, j.returnAt, j.pickupLocal, j.returnLocal,
      j.leadTimeDays, j.durationDays, j.driverAge, j.currency,
      j.maxAttempts, j.priority, j.dedupeKey,
    );
  });

  const { rowCount } = await db.query(
    `insert into market_intel.collection_jobs
       (run_id, source_id, source_code, pickup_location_code, return_location_code,
        pickup_at, return_at, pickup_local, return_local,
        lead_time_days, duration_days, driver_age, currency,
        max_attempts, priority, dedupe_key)
     values ${tuples.join(',')}
     on conflict (dedupe_key) do nothing`,
    values,
  );

  await db.query(
    `update market_intel.collection_runs
        set planned_jobs = (select count(*) from market_intel.collection_jobs where run_id = $1)
      where id = $1`,
    [jobs[0]!.runId],
  );

  return rowCount ?? 0;
}

/**
 * Atomically claim the next runnable job. FOR UPDATE SKIP LOCKED is what makes
 * it safe to run several workers (or several machines) against one queue.
 *
 * Auto-disabled sources are skipped here rather than at planning time, so a
 * source can be re-enabled without re-planning.
 */
export async function claimNextJob(
  db: Db,
  workerId: string,
  options: { sourceCode?: string; runId?: string } = {},
): Promise<JobRow | undefined> {
  const { rows } = await db.query<JobRow>(
    `with next as (
       select j.id
         from market_intel.collection_jobs j
         join market_intel.sources s on s.code = j.source_code
        where j.status = 'pending'
          and j.scheduled_for <= now()
          and s.enabled and not s.auto_disabled
          and ($2::text is null or j.source_code = $2)
          and ($3::uuid is null or j.run_id = $3)
        order by j.priority, j.scheduled_for, j.id
        for update of j skip locked
        limit 1
     )
     update market_intel.collection_jobs j
        set status = 'running', locked_at = now(), locked_by = $1,
            started_at = coalesce(j.started_at, now()), attempts = j.attempts + 1
       from next
      where j.id = next.id
      returning j.*`,
    [workerId, options.sourceCode ?? null, options.runId ?? null],
  );
  return rows[0];
}

export async function completeJob(
  db: Db,
  jobId: number,
  result: { offersCollected: number; durationMs: number },
): Promise<void> {
  await db.query(
    `update market_intel.collection_jobs
        set status = 'succeeded', finished_at = now(), locked_at = null, locked_by = null,
            offers_collected = $2, duration_ms = $3, last_error = null
      where id = $1`,
    [jobId, result.offersCollected, result.durationMs],
  );
}

/**
 * A failed attempt either goes back on the queue (with backoff baked into
 * scheduled_for) or is marked failed for good once max_attempts is spent.
 */
export async function failJob(
  db: Db,
  jobId: number,
  error: string,
  retryDelayMs: number,
): Promise<{ status: JobStatus; attempts: number }> {
  const { rows } = await db.query<{ status: JobStatus; attempts: number }>(
    `update market_intel.collection_jobs
        set status = case when attempts >= max_attempts then 'failed' else 'pending' end,
            scheduled_for = case when attempts >= max_attempts
                                 then scheduled_for
                                 else now() + ($3::int * interval '1 millisecond') end,
            finished_at = case when attempts >= max_attempts then now() else null end,
            locked_at = null, locked_by = null,
            last_error = $2
      where id = $1
      returning status, attempts`,
    [jobId, error.slice(0, 2000), retryDelayMs],
  );
  return rows[0] ?? { status: 'failed', attempts: 0 };
}

/** Releases jobs whose worker died holding the lock. */
export async function releaseStaleJobs(db: Db, lockTimeoutMs: number): Promise<number> {
  const { rowCount } = await db.query(
    `update market_intel.collection_jobs
        set status = 'pending', locked_at = null, locked_by = null,
            last_error = coalesce(last_error, 'released after lock timeout')
      where status = 'running'
        and locked_at < now() - ($1::int * interval '1 millisecond')`,
    [lockTimeoutMs],
  );
  return rowCount ?? 0;
}

export async function finishRun(db: Db, runId: string): Promise<void> {
  await db.query(
    `update market_intel.collection_runs r
        set status = case when exists (
                            select 1 from market_intel.collection_jobs j
                             where j.run_id = r.id and j.status in ('pending','running'))
                          then 'running' else 'completed' end,
            finished_at = now(),
            succeeded_jobs = (select count(*) from market_intel.collection_jobs j
                               where j.run_id = r.id and j.status = 'succeeded'),
            failed_jobs = (select count(*) from market_intel.collection_jobs j
                            where j.run_id = r.id and j.status = 'failed'),
            offers_collected = (select coalesce(sum(o.cnt),0) from (
                                 select count(*) as cnt from market_intel.market_price_observations
                                  where run_id = r.id) o)
      where r.id = $1`,
    [runId],
  );
}

export async function markRunStarted(db: Db, runId: string): Promise<void> {
  await db.query(
    `update market_intel.collection_runs
        set status = 'running', started_at = coalesce(started_at, now())
      where id = $1`,
    [runId],
  );
}

export async function countPendingJobs(db: Db, runId?: string): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    `select count(*)::int as count from market_intel.collection_jobs
      where status = 'pending' and ($1::uuid is null or run_id = $1)`,
    [runId ?? null],
  );
  return rows[0]?.count ?? 0;
}

export async function jobStats(
  db: Db,
  runId?: string,
): Promise<Array<{ status: JobStatus; count: number }>> {
  const { rows } = await db.query<{ status: JobStatus; count: number }>(
    `select status, count(*)::int as count
       from market_intel.collection_jobs
      where ($1::uuid is null or run_id = $1)
      group by status order by status`,
    [runId ?? null],
  );
  return rows;
}

export type { DbClient };
