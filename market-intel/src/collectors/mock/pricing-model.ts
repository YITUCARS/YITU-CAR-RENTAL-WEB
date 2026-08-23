import { shortHash } from '../../utils/hash.js';

/** Deterministic PRNG so the same query always yields the same fake market. */
export function seededRandom(seed: string): () => number {
  let h = 0;
  const digest = shortHash(seed);
  for (let i = 0; i < digest.length; i++) h = (Math.imul(31, h) + digest.charCodeAt(i)) | 0;
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** NZD/day floor per class, roughly Christchurch shoulder-season shaped. */
export const BASE_DAILY_PRICE: Record<string, number> = {
  ECONOMY: 42,
  COMPACT: 52,
  MIDSIZE: 64,
  FULLSIZE: 78,
  COMPACT_SUV: 72,
  MIDSIZE_SUV: 92,
  LARGE_SUV: 128,
  PREMIUM: 165,
  EV: 88,
  VAN_8_SEAT: 145,
  VAN_12_SEAT: 189,
};

/**
 * Christchurch demand by month: peak over the NZ summer holidays, trough in
 * winter. Index 0 = January.
 */
const SEASONALITY = [1.45, 1.35, 1.15, 1.0, 0.85, 0.78, 0.8, 0.82, 0.92, 1.05, 1.15, 1.4];

export function seasonalFactor(pickupAt: Date, timezoneOffsetMonth?: number): number {
  const month = timezoneOffsetMonth ?? pickupAt.getUTCMonth();
  return SEASONALITY[month] ?? 1;
}

/**
 * The booking curve this whole project exists to measure: prices climb as the
 * pickup date approaches, steeply inside two weeks.
 *   90d -> ~1.00x, 30d -> ~1.08x, 7d -> ~1.28x, 1d -> ~1.55x
 */
export function leadTimeFactor(leadTimeDays: number): number {
  const days = Math.max(0, leadTimeDays);
  return 1 + 0.62 * Math.exp(-days / 18);
}

/** Longer rentals are cheaper per day. */
export function durationFactor(durationDays: number): number {
  if (durationDays >= 7) return 0.86;
  if (durationDays >= 5) return 0.91;
  if (durationDays >= 3) return 0.96;
  return 1.08;
}

/** Per-supplier positioning: budget brands sit below the premium ones. */
export function supplierFactor(supplier: string): number {
  const rng = seededRandom(`supplier:${supplier}`);
  return 0.82 + rng() * 0.45;
}
