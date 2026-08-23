import type { Db } from '../client.js';
import type { MarketPriceObservation } from '../../models/index.js';
import type { NormalizeResult } from '../../normalizers/offer.js';

const COLUMNS = [
  'job_id', 'run_id', 'observed_at',
  'source_code', 'source_type', 'channel', 'supplier', 'supplier_raw',
  'pickup_location_code', 'return_location_code', 'pickup_location_raw', 'return_location_raw',
  'pickup_datetime', 'return_datetime', 'pickup_datetime_local', 'return_datetime_local',
  'lead_time_days', 'duration_days',
  'vehicle_name_raw', 'vehicle_or_similar_text', 'vehicle_class_raw', 'vehicle_class',
  'vehicle_class_method', 'vehicle_class_confidence', 'acriss_code',
  'transmission', 'transmission_raw', 'fuel_type', 'fuel_type_raw', 'seats', 'bags', 'doors',
  'currency', 'total_price', 'daily_price', 'total_price_raw', 'daily_price_raw',
  'price_includes_taxes', 'pay_type',
  'availability', 'availability_raw', 'mileage_unlimited', 'mileage_limit_km', 'mileage_limit_raw',
  'deposit_amount', 'deposit_raw', 'insurance_excess_amount', 'insurance_excess_raw',
  'insurance_product', 'location_fees', 'location_fees_raw', 'fees',
  'source_url', 'offer_fingerprint', 'collector_version', 'raw',
] as const;

function toValues(o: MarketPriceObservation): unknown[] {
  return [
    o.jobId ?? null, o.runId, o.observedAt,
    o.sourceCode, o.sourceType, o.channel, o.supplier ?? null, o.supplierRaw ?? null,
    o.pickupLocationCode, o.returnLocationCode, o.pickupLocationRaw ?? null, o.returnLocationRaw ?? null,
    o.pickupDatetime, o.returnDatetime, o.pickupDatetimeLocal, o.returnDatetimeLocal,
    o.leadTimeDays, o.durationDays,
    o.vehicleNameRaw, o.vehicleOrSimilarText ?? null, o.vehicleClassRaw ?? null, o.vehicleClass ?? null,
    o.vehicleClassMethod, o.vehicleClassConfidence ?? null, o.acrissCode ?? null,
    o.transmission, o.transmissionRaw ?? null, o.fuelType, o.fuelTypeRaw ?? null,
    o.seats ?? null, o.bags ?? null, o.doors ?? null,
    o.currency, o.totalPrice ?? null, o.dailyPrice ?? null, o.totalPriceRaw ?? null, o.dailyPriceRaw ?? null,
    o.priceIncludesTaxes ?? null, o.payType ?? null,
    o.availability, o.availabilityRaw ?? null, o.mileageUnlimited ?? null,
    o.mileageLimitKm ?? null, o.mileageLimitRaw ?? null,
    o.depositAmount ?? null, o.depositRaw ?? null,
    o.insuranceExcessAmount ?? null, o.insuranceExcessRaw ?? null, o.insuranceProduct ?? null,
    o.locationFees ?? null, o.locationFeesRaw ?? null, o.fees ?? null,
    o.sourceUrl ?? null, o.offerFingerprint ?? null, o.collectorVersion ?? null, o.raw,
  ];
}

/**
 * Append-only insert. There is deliberately no update path and no unique
 * constraint that would collapse repeat observations: two rows for the same
 * car and the same pickup date, observed a week apart, ARE the dataset.
 */
export async function insertObservations(
  db: Db,
  observations: MarketPriceObservation[],
): Promise<number> {
  if (observations.length === 0) return 0;

  const width = COLUMNS.length;
  const values: unknown[] = [];
  const tuples = observations.map((o, i) => {
    const base = i * width;
    values.push(...toValues(o));
    return `(${Array.from({ length: width }, (_, k) => `$${base + k + 1}`).join(',')})`;
  });

  const { rowCount } = await db.query(
    `insert into market_intel.market_price_observations (${COLUMNS.join(',')})
     values ${tuples.join(',')}`,
    values,
  );
  return rowCount ?? 0;
}

/**
 * Vehicles the deterministic classifier could not place. Counted rather than
 * duplicated, so the review queue is ordered by how much each unknown actually
 * costs us in lost data.
 */
export async function recordUnresolvedVehicles(
  db: Db,
  unresolved: NonNullable<NormalizeResult['unresolved']>[],
): Promise<void> {
  for (const u of unresolved) {
    await db.query(
      `insert into market_intel.vehicle_class_unresolved
         (vehicle_name_raw, normalized_key, vehicle_class_raw, source_code, sample_seats, sample_url)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (source_code, normalized_key) do update
         set occurrences = market_intel.vehicle_class_unresolved.occurrences + 1,
             last_seen_at = now(),
             sample_url = coalesce(excluded.sample_url, market_intel.vehicle_class_unresolved.sample_url)`,
      [u.vehicleNameRaw, u.normalizedKey, u.vehicleClassRaw ?? null, u.sourceCode, u.sampleSeats ?? null, u.sampleUrl ?? null],
    );
  }
}

export async function loadMappingRules(db: Db): Promise<Record<string, unknown>[]> {
  const { rows } = await db.query<Record<string, unknown>>(
    `select id, match_type, pattern, source_code, vehicle_class, seats_min, seats_max, priority, confidence
       from market_intel.vehicle_class_mapping
      where active
      order by priority, length(pattern) desc`,
  );
  return rows;
}

export interface ObservationSummary {
  source_code: string;
  offers: number;
  classified: number;
  unclassified: number;
  min_daily: number | null;
  median_daily: number | null;
  max_daily: number | null;
}

export async function summariseRun(db: Db, runId: string): Promise<ObservationSummary[]> {
  const { rows } = await db.query<ObservationSummary>(
    `select source_code,
            count(*)::int as offers,
            count(vehicle_class)::int as classified,
            (count(*) - count(vehicle_class))::int as unclassified,
            min(daily_price) as min_daily,
            percentile_cont(0.5) within group (order by daily_price) as median_daily,
            max(daily_price) as max_daily
       from market_intel.market_price_observations
      where run_id = $1 and availability = 'available'
      group by source_code order by source_code`,
    [runId],
  );
  return rows;
}

/** The booking curve for one pickup date — the headline query of the project. */
export async function leadTimeCurve(
  db: Db,
  params: { locationCode: string; pickupDate: string; vehicleClass: string; durationDays: number },
): Promise<Array<Record<string, unknown>>> {
  const { rows } = await db.query(
    `select observed_date, days_before_pickup, offer_count,
            min_daily_price, median_daily_price, max_daily_price, currency
       from market_intel.v_lead_time_curve
      where pickup_location_code = $1
        and pickup_date = $2::date
        and vehicle_class = $3
        and duration_days = $4
      order by observed_date`,
    [params.locationCode, params.pickupDate, params.vehicleClass, params.durationDays],
  );
  return rows;
}
