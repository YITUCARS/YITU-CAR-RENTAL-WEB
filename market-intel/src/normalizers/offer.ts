import type {
  Availability,
  FuelType,
  MarketPriceObservation,
  SearchQuery,
  Transmission,
  VehicleOffer,
} from '../models/index.js';
import { durationDays as computeDuration, leadTimeDays as computeLeadTime } from '../utils/dates.js';
import { shortHash } from '../utils/hash.js';
import { clean, normalizeKey, parseCurrency, parseMoney, splitOrSimilar } from '../utils/text.js';
import { normalizeSupplier } from './supplier.js';
import type { VehicleClassifier } from './vehicle-class.js';

export interface NormalizeResult {
  observation: MarketPriceObservation;
  /** set when the deterministic classifier could not decide */
  unresolved?: {
    vehicleNameRaw: string;
    normalizedKey: string;
    vehicleClassRaw?: string;
    sourceCode: string;
    sampleSeats?: number;
    sampleUrl?: string;
  };
}

export function normalizeTransmission(raw: string | undefined): Transmission {
  const key = raw ? normalizeKey(raw) : '';
  if (!key) return 'unknown';
  if (/\bmanual\b|\bstick\b/.test(key)) return 'manual';
  if (/\bauto/.test(key) || /\bcvt\b|\btiptronic\b|\bdsg\b/.test(key)) return 'automatic';
  return 'unknown';
}

export function normalizeFuelType(raw: string | undefined): FuelType {
  const key = raw ? normalizeKey(raw) : '';
  if (!key) return 'unknown';
  if (/plug ?in/.test(key)) return 'plugin_hybrid';
  if (/\bphev\b/.test(key)) return 'plugin_hybrid';
  if (/hybrid|\bhev\b/.test(key)) return 'hybrid';
  if (/electric|\bev\b|battery/.test(key)) return 'electric';
  if (/diesel/.test(key)) return 'diesel';
  if (/petrol|gasoline|unleaded|\bpulp\b/.test(key)) return 'petrol';
  return 'unknown';
}

export function normalizeAvailability(offer: VehicleOffer): Availability {
  if (offer.availability) return offer.availability;
  const key = offer.availabilityRaw ? normalizeKey(offer.availabilityRaw) : '';
  if (/sold out|unavailable|not available|no longer/.test(key)) return 'sold_out';
  if (/on request|enquire|call/.test(key)) return 'on_request';
  if (key) return 'available';
  // no availability signal at all: if it is priced, it was on sale
  return offer.totalPrice !== undefined || offer.dailyPrice !== undefined ? 'available' : 'unknown';
}

/** 'Unlimited kilometres' / '200 km per day' -> structured mileage terms. */
export function normalizeMileage(offer: VehicleOffer): { unlimited?: boolean; limitKm?: number } {
  if (offer.mileageUnlimited !== undefined || offer.mileageLimitKm !== undefined) {
    return { unlimited: offer.mileageUnlimited, limitKm: offer.mileageLimitKm };
  }
  const raw = offer.mileageLimitRaw;
  if (!raw) return {};
  const key = normalizeKey(raw);
  if (/unlimited/.test(key)) return { unlimited: true };
  const match = /(\d[\d ]*)\s*(km|kms|kilometres|kilometers|miles)/.exec(key);
  if (match) {
    const value = Number.parseInt(match[1]!.replace(/\s/g, ''), 10);
    if (Number.isFinite(value)) {
      const km = match[2]!.startsWith('mile') ? Math.round(value * 1.60934) : value;
      return { unlimited: false, limitKm: km };
    }
  }
  return {};
}

/**
 * Turns one raw offer into one database row.
 *
 * Two rules govern this function:
 *   1. never invent a value — an unparseable price stays null, with the raw
 *      string kept, rather than becoming a plausible guess
 *   2. never lose a value — every normalized field keeps its raw counterpart,
 *      and the full extracted record goes into `raw`
 */
export function normalizeOffer(
  query: SearchQuery,
  offer: VehicleOffer,
  classifier: VehicleClassifier,
  collectorVersion?: string,
): NormalizeResult {
  const source = query.source;
  const { orSimilar } = splitOrSimilar(offer.vehicleNameRaw);

  const currency = offer.currency
    ? parseCurrency(offer.currency, query.currency)
    : parseCurrency(offer.totalPriceRaw ?? offer.dailyPriceRaw, query.currency);

  const totalPrice = offer.totalPrice ?? parseMoney(offer.totalPriceRaw);
  let dailyPrice = offer.dailyPrice ?? parseMoney(offer.dailyPriceRaw);

  const durationDays = computeDuration(query.pickupAt, query.returnAt);
  // Derive whichever side the source did not show. Comparing a 1-day and a
  // 7-day quote is only meaningful per day.
  let derivedTotal = totalPrice;
  if (dailyPrice === undefined && totalPrice !== undefined && durationDays > 0) {
    dailyPrice = round2(totalPrice / durationDays);
  } else if (derivedTotal === undefined && dailyPrice !== undefined && durationDays > 0) {
    derivedTotal = round2(dailyPrice * durationDays);
  }

  const classification = classifier.classify({
    vehicleNameRaw: offer.vehicleNameRaw,
    vehicleClassRaw: offer.vehicleClassRaw,
    seats: offer.seats,
    fuelTypeRaw: offer.fuelTypeRaw,
    sourceCode: source.code,
  });

  const mileage = normalizeMileage(offer);
  const supplierRaw = clean(offer.supplierRaw) ?? (source.type === 'direct' ? source.name : undefined);
  const channel = clean(offer.channel) ?? source.name;

  const observation: MarketPriceObservation = {
    jobId: query.jobId,
    runId: query.runId,
    observedAt: query.observedAt,

    sourceCode: source.code,
    sourceType: source.type,
    channel,
    supplier: normalizeSupplier(supplierRaw),
    supplierRaw,

    pickupLocationCode: query.pickup.code,
    returnLocationCode: query.dropoff.code,
    pickupLocationRaw: query.pickup.sourceLocationLabel ?? query.pickup.sourceLocationCode,
    returnLocationRaw: query.dropoff.sourceLocationLabel ?? query.dropoff.sourceLocationCode,
    pickupDatetime: query.pickupAt,
    returnDatetime: query.returnAt,
    pickupDatetimeLocal: query.pickupLocal,
    returnDatetimeLocal: query.returnLocal,
    // recomputed from the actual observation instant, not trusted from the plan
    leadTimeDays: computeLeadTime(query.observedAt, query.pickupAt, query.pickup.timezone),
    durationDays,

    vehicleNameRaw: offer.vehicleNameRaw,
    vehicleOrSimilarText: orSimilar,
    vehicleClassRaw: clean(offer.vehicleClassRaw),
    vehicleClass: classification.vehicleClass,
    vehicleClassMethod: classification.method,
    vehicleClassConfidence: classification.confidence,
    acrissCode: clean(offer.acrissCode),
    transmission: offer.transmission ?? normalizeTransmission(offer.transmissionRaw),
    transmissionRaw: clean(offer.transmissionRaw),
    fuelType: offer.fuelType ?? normalizeFuelType(offer.fuelTypeRaw),
    fuelTypeRaw: clean(offer.fuelTypeRaw),
    seats: offer.seats,
    bags: offer.bags,
    doors: offer.doors,

    currency,
    totalPrice: derivedTotal,
    dailyPrice,
    totalPriceRaw: clean(offer.totalPriceRaw),
    dailyPriceRaw: clean(offer.dailyPriceRaw),
    priceIncludesTaxes: offer.priceIncludesTaxes,
    payType: offer.payType,

    availability: normalizeAvailability(offer),
    availabilityRaw: clean(offer.availabilityRaw),
    mileageUnlimited: mileage.unlimited,
    mileageLimitKm: mileage.limitKm,
    mileageLimitRaw: clean(offer.mileageLimitRaw),
    depositAmount: offer.depositAmount ?? parseMoney(offer.depositRaw),
    depositRaw: clean(offer.depositRaw),
    insuranceExcessAmount: offer.insuranceExcessAmount ?? parseMoney(offer.insuranceExcessRaw),
    insuranceExcessRaw: clean(offer.insuranceExcessRaw),
    insuranceProduct: clean(offer.insuranceProduct),
    locationFees: offer.locationFees ?? parseMoney(offer.locationFeesRaw),
    locationFeesRaw: clean(offer.locationFeesRaw),
    fees: offer.fees,

    sourceUrl: offer.sourceUrl,
    offerFingerprint:
      offer.offerFingerprint ??
      shortHash(source.code, channel, supplierRaw, offer.vehicleNameRaw, query.pickupLocal, durationDays),
    collectorVersion,
    raw: offer.raw ?? {},
  };

  const result: NormalizeResult = { observation };

  if (classification.method === 'unresolved') {
    result.unresolved = {
      vehicleNameRaw: offer.vehicleNameRaw,
      normalizedKey: normalizeKey(offer.vehicleNameRaw),
      vehicleClassRaw: clean(offer.vehicleClassRaw),
      sourceCode: source.code,
      sampleSeats: offer.seats,
      sampleUrl: offer.sourceUrl,
    };
  }

  return result;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
