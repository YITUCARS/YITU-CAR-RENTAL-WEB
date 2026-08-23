import type { Db } from '../client.js';
import type { CollectionError } from '../../utils/errors.js';
import { errorTypeOf } from '../../utils/errors.js';

export interface ErrorArtifacts {
  screenshotPath?: string;
  htmlSnapshotPath?: string;
}

/**
 * Every failed attempt is recorded, not just the final one: a job that
 * succeeds on attempt 3 still tells us the source is getting flaky.
 */
export async function recordError(
  db: Db,
  params: {
    jobId?: number;
    runId?: string;
    sourceCode: string;
    error: CollectionError;
    attempt: number;
    artifacts?: ErrorArtifacts;
    context?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = params;
  await db.query(
    `insert into market_intel.collection_errors
       (job_id, run_id, source_code, stage, error_type, message, stack, attempt,
        retryable, http_status, url, screenshot_path, html_snapshot_path, context)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      params.jobId ?? null,
      params.runId ?? null,
      params.sourceCode,
      error.stage,
      errorTypeOf(error),
      error.message.slice(0, 4000),
      error.stack?.slice(0, 8000) ?? null,
      params.attempt,
      error.retryable,
      error.httpStatus ?? null,
      error.url ?? null,
      params.artifacts?.screenshotPath ?? null,
      params.artifacts?.htmlSnapshotPath ?? null,
      { ...error.context, ...params.context },
    ],
  );
}

export async function recentErrors(db: Db, limit = 20): Promise<Array<Record<string, unknown>>> {
  const { rows } = await db.query(
    `select id, source_code, stage, error_type, message, attempt, occurred_at,
            screenshot_path, html_snapshot_path
       from market_intel.collection_errors
      order by occurred_at desc limit $1`,
    [limit],
  );
  return rows;
}
