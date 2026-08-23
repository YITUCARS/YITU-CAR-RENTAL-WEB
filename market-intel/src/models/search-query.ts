import type { LocationConfig, SourceConfig } from '../config/types.js';

/** Where a search picks up or drops off, in both our terms and the source's. */
export interface QueryLocation {
  /** our stable code, e.g. CHC_APT */
  code: string;
  name: string;
  timezone: string;
  /** the identifier this particular source uses for the same place */
  sourceLocationCode: string;
  sourceLocationLabel?: string;
  params: Record<string, unknown>;
}

/**
 * One search to perform against one source. Produced by the job planner,
 * handed to a collector, and never mutated by the collector.
 */
export interface SearchQuery {
  runId: string;
  jobId?: number;
  source: SourceConfig;

  pickup: QueryLocation;
  dropoff: QueryLocation;

  /** absolute instants */
  pickupAt: Date;
  returnAt: Date;
  /** 'YYYY-MM-DD HH:mm:ss' local wall time at the location */
  pickupLocal: string;
  returnLocal: string;

  /** planned lead time in days, i.e. the booking-curve bucket */
  leadTimeDays: number;
  durationDays: number;

  driverAge: number;
  currency: string;
  /** clock time when this query is being executed; stamped on observations */
  observedAt: Date;
}

export function describeQuery(q: SearchQuery): string {
  return `${q.source.code} ${q.pickup.code} ${q.pickupLocal.slice(0, 10)} +${q.durationDays}d (lead ${q.leadTimeDays}d)`;
}

export function resolveQueryLocation(
  source: SourceConfig,
  location: LocationConfig,
): QueryLocation | undefined {
  const mapping = source.locations[location.code];
  if (!mapping) return undefined;
  return {
    code: location.code,
    name: location.name,
    timezone: location.timezone,
    sourceLocationCode: mapping.code,
    sourceLocationLabel: mapping.label,
    params: mapping.params,
  };
}
