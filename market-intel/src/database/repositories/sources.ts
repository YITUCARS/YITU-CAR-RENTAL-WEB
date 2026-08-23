import type { Db } from '../client.js';
import type { LocationConfig, SourceConfig } from '../../config/types.js';

export interface SourceRow {
  id: number;
  code: string;
  name: string;
  source_type: 'direct' | 'ota';
  collector: string;
  access_mode: string;
  base_url: string;
  search_url: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
  consecutive_failures: number;
  auto_disabled: boolean;
  auto_disabled_reason: string | null;
  last_success_at: Date | null;
  last_attempt_at: Date | null;
}

/**
 * sources.yaml is the source of truth for intent; the database owns runtime
 * health. Syncing therefore overwrites the config columns and deliberately
 * leaves consecutive_failures / auto_disabled alone.
 */
export async function syncSources(db: Db, sources: SourceConfig[]): Promise<SourceRow[]> {
  const rows: SourceRow[] = [];
  for (const s of sources) {
    const config = {
      locations: s.locations,
      rate_limit: s.rateLimit,
      retry: s.retry,
      timeout_ms: s.timeoutMs,
      options: s.options,
      notes: s.notes,
    };
    const { rows: result } = await db.query<SourceRow>(
      `insert into market_intel.sources
         (code, name, source_type, collector, access_mode, base_url, search_url, enabled, config)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (code) do update set
         name = excluded.name,
         source_type = excluded.source_type,
         collector = excluded.collector,
         access_mode = excluded.access_mode,
         base_url = excluded.base_url,
         search_url = excluded.search_url,
         enabled = excluded.enabled,
         config = excluded.config
       returning *`,
      [s.code, s.name, s.type, s.collector, s.access, s.baseUrl, s.searchUrl ?? null, s.enabled, config],
    );
    rows.push(result[0]!);
  }
  return rows;
}

export async function syncLocations(db: Db, locations: LocationConfig[]): Promise<void> {
  for (const l of locations) {
    await db.query(
      `insert into market_intel.locations (code, name, iata, city, country, timezone, currency, enabled)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (code) do update set
         name = excluded.name, iata = excluded.iata, city = excluded.city,
         country = excluded.country, timezone = excluded.timezone,
         currency = excluded.currency, enabled = excluded.enabled`,
      [l.code, l.name, l.iata ?? null, l.city ?? null, l.country, l.timezone, l.currency, l.enabled],
    );
  }
}

export async function listSources(db: Db): Promise<SourceRow[]> {
  const { rows } = await db.query<SourceRow>('select * from market_intel.sources order by code');
  return rows;
}

export async function getSourceByCode(db: Db, code: string): Promise<SourceRow | undefined> {
  const { rows } = await db.query<SourceRow>('select * from market_intel.sources where code = $1', [code]);
  return rows[0];
}

export async function recordSourceSuccess(db: Db, code: string): Promise<void> {
  await db.query(
    `update market_intel.sources
        set last_attempt_at = now(), last_success_at = now(), consecutive_failures = 0
      where code = $1`,
    [code],
  );
}

/**
 * Counts a failure and auto-disables the source once it has failed
 * `threshold` times in a row. Auto-disable is a circuit breaker: it stops us
 * hammering a site that has changed or is unhappy, and it surfaces on the
 * dashboard for a human to look at.
 */
export async function recordSourceFailure(
  db: Db,
  code: string,
  threshold: number,
  reason: string,
): Promise<{ autoDisabled: boolean; consecutiveFailures: number }> {
  const { rows } = await db.query<{ consecutive_failures: number; auto_disabled: boolean }>(
    `update market_intel.sources
        set last_attempt_at = now(),
            consecutive_failures = consecutive_failures + 1,
            auto_disabled = (consecutive_failures + 1) >= $2,
            auto_disabled_at = case when (consecutive_failures + 1) >= $2 and not auto_disabled
                                    then now() else auto_disabled_at end,
            auto_disabled_reason = case when (consecutive_failures + 1) >= $2 and not auto_disabled
                                        then $3 else auto_disabled_reason end
      where code = $1
      returning consecutive_failures, auto_disabled`,
    [code, threshold, reason],
  );
  const row = rows[0];
  return {
    autoDisabled: row?.auto_disabled ?? false,
    consecutiveFailures: row?.consecutive_failures ?? 0,
  };
}

/** Manual reset after a fix: clears the breaker without touching yaml. */
export async function reEnableSource(db: Db, code: string): Promise<void> {
  await db.query(
    `update market_intel.sources
        set auto_disabled = false, auto_disabled_at = null,
            auto_disabled_reason = null, consecutive_failures = 0
      where code = $1`,
    [code],
  );
}
