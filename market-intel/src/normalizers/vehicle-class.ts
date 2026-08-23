import type { Classification, VehicleClass } from '../models/vehicle-class.js';
import { isVehicleClass } from '../models/vehicle-class.js';
import { normalizeKey, splitOrSimilar } from '../utils/text.js';

export interface MappingRule {
  id?: number;
  matchType: 'exact' | 'contains' | 'regex';
  pattern: string;
  sourceCode?: string | null;
  vehicleClass: VehicleClass;
  seatsMin?: number | null;
  seatsMax?: number | null;
  priority: number;
  confidence: number;
}

export interface ClassificationInput {
  vehicleNameRaw: string;
  vehicleClassRaw?: string;
  seats?: number;
  fuelTypeRaw?: string;
  sourceCode: string;
}

/**
 * Deterministic vehicle classifier.
 *
 * Rules are data (market_intel.vehicle_class_mapping), not code, so a new
 * competitor's naming quirks are a row insert rather than a deploy. Nothing
 * here calls an LLM: an ambiguous listing becomes `unresolved` and lands on the
 * manual-review queue, because a wrong-but-confident class silently corrupts
 * every median it touches, while an unresolved one is merely missing.
 */
export class VehicleClassifier {
  private readonly rules: MappingRule[];

  constructor(rules: MappingRule[]) {
    // lower priority number first; ties broken by longer (more specific) pattern
    this.rules = [...rules].sort(
      (a, b) => a.priority - b.priority || b.pattern.length - a.pattern.length,
    );
  }

  classify(input: ClassificationInput): Classification {
    const { model, orSimilar } = splitOrSimilar(input.vehicleNameRaw);
    void orSimilar;

    const nameKey = normalizeKey(model);
    const fullKey = normalizeKey(input.vehicleNameRaw);
    const classKey = input.vehicleClassRaw ? normalizeKey(input.vehicleClassRaw) : '';

    // --- hard pre-rules: signals that beat any name match --------------------
    const fuelKey = input.fuelTypeRaw ? normalizeKey(input.fuelTypeRaw) : '';
    if (fuelKey === 'electric' || fuelKey === 'ev' || fuelKey === 'battery electric') {
      return { vehicleClass: 'EV', method: 'rule', confidence: 0.95, matchedPattern: 'fuel=electric' };
    }
    // 9 seats or more is a minibus whatever the badge says
    if (input.seats !== undefined && input.seats >= 9) {
      return { vehicleClass: 'VAN_12_SEAT', method: 'rule', confidence: 0.95, matchedPattern: 'seats>=9' };
    }

    // --- mapping table: vehicle name first, then the source's class label ----
    for (const candidate of [nameKey, fullKey, classKey]) {
      if (!candidate) continue;
      const hit = this.match(candidate, input);
      if (hit) return this.applySeatAdjustments(hit, input);
    }

    return { method: 'unresolved', confidence: 0 };
  }

  private match(key: string, input: ClassificationInput): Classification | undefined {
    for (const rule of this.rules) {
      if (rule.sourceCode && rule.sourceCode !== input.sourceCode) continue;
      if (rule.seatsMin != null && (input.seats ?? -1) < rule.seatsMin) continue;
      if (rule.seatsMax != null && (input.seats ?? 999) > rule.seatsMax) continue;
      if (!this.test(rule, key)) continue;
      return {
        vehicleClass: rule.vehicleClass,
        method: 'mapping',
        confidence: rule.confidence,
        matchedPattern: `${rule.matchType}:${rule.pattern}`,
      };
    }
    return undefined;
  }

  private test(rule: MappingRule, key: string): boolean {
    switch (rule.matchType) {
      case 'exact':
        return key === rule.pattern;
      case 'contains':
        return key.includes(rule.pattern);
      case 'regex':
        try {
          // patterns are stored in Postgres regex form; \m and \M are word
          // boundaries there, \b here
          return new RegExp(rule.pattern.replace(/\\m|\\M/g, '\\b'), 'i').test(key);
        } catch {
          return false;
        }
    }
  }

  /**
   * A 7-seat "Outlander" is sold as a large SUV, a 5-seat one is not. Seat
   * count is the more reliable signal, so it wins over the name match.
   */
  private applySeatAdjustments(hit: Classification, input: ClassificationInput): Classification {
    const seats = input.seats;
    if (seats === undefined || !hit.vehicleClass) return hit;

    if (seats >= 9 && hit.vehicleClass !== 'VAN_12_SEAT') {
      return { vehicleClass: 'VAN_12_SEAT', method: 'rule', confidence: 0.9, matchedPattern: 'seats>=9' };
    }
    // a 7-8 seat vehicle that matched a van rule is a people mover
    if (seats >= 7 && seats <= 8 && hit.vehicleClass === 'VAN_12_SEAT') {
      return { vehicleClass: 'VAN_8_SEAT', method: 'rule', confidence: 0.88, matchedPattern: 'seats 7-8 van' };
    }
    if (seats >= 7 && (hit.vehicleClass === 'MIDSIZE_SUV' || hit.vehicleClass === 'COMPACT_SUV')) {
      return {
        vehicleClass: 'LARGE_SUV',
        method: 'rule',
        confidence: Math.min(hit.confidence, 0.85),
        matchedPattern: `${hit.matchedPattern ?? 'mapping'}+seats>=7`,
      };
    }
    return hit;
  }
}

/**
 * Minimal fallback set used when the database is unreachable or in unit tests.
 * The real rule set lives in sql/002_seed_vehicle_classes.sql.
 */
export const FALLBACK_RULES: MappingRule[] = [
  { matchType: 'contains', pattern: 'rav4', vehicleClass: 'MIDSIZE_SUV', priority: 40, confidence: 0.96 },
  { matchType: 'contains', pattern: 'mg zs', vehicleClass: 'COMPACT_SUV', priority: 40, confidence: 0.95 },
  { matchType: 'contains', pattern: 'qashqai', vehicleClass: 'COMPACT_SUV', priority: 40, confidence: 0.95 },
  { matchType: 'contains', pattern: 'corolla', vehicleClass: 'COMPACT', priority: 40, confidence: 0.94 },
  { matchType: 'contains', pattern: 'yaris', vehicleClass: 'ECONOMY', priority: 45, confidence: 0.9 },
  { matchType: 'contains', pattern: 'intermediate suv', vehicleClass: 'MIDSIZE_SUV', priority: 62, confidence: 0.9 },
  { matchType: 'exact', pattern: 'economy', vehicleClass: 'ECONOMY', priority: 60, confidence: 0.85 },
];

export function toMappingRule(row: Record<string, unknown>): MappingRule {
  const vehicleClass = String(row.vehicle_class);
  if (!isVehicleClass(vehicleClass)) {
    throw new Error(`Mapping row ${String(row.id)} has unknown vehicle_class "${vehicleClass}"`);
  }
  return {
    id: Number(row.id),
    matchType: row.match_type as MappingRule['matchType'],
    pattern: String(row.pattern),
    sourceCode: (row.source_code as string | null) ?? null,
    vehicleClass,
    seatsMin: (row.seats_min as number | null) ?? null,
    seatsMax: (row.seats_max as number | null) ?? null,
    priority: Number(row.priority),
    confidence: Number(row.confidence),
  };
}
