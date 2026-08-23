import { describe, expect, it } from 'vitest';
import { VehicleClassifier, FALLBACK_RULES, type MappingRule } from '../src/normalizers/vehicle-class.js';
import { normalizeSupplier } from '../src/normalizers/supplier.js';

const rules: MappingRule[] = [
  ...FALLBACK_RULES,
  { matchType: 'contains', pattern: 'outlander', vehicleClass: 'MIDSIZE_SUV', priority: 42, confidence: 0.88 },
  { matchType: 'contains', pattern: 'hiace commuter', vehicleClass: 'VAN_12_SEAT', priority: 20, confidence: 0.97 },
  { matchType: 'contains', pattern: 'kona electric', vehicleClass: 'EV', priority: 10, confidence: 0.99 },
  { matchType: 'contains', pattern: 'kona', vehicleClass: 'COMPACT_SUV', priority: 45, confidence: 0.9 },
];
const classifier = new VehicleClassifier(rules);

const classify = (vehicleNameRaw: string, extra: Partial<Parameters<typeof classifier.classify>[0]> = {}) =>
  classifier.classify({ vehicleNameRaw, sourceCode: 'test', ...extra });

describe('VehicleClassifier', () => {
  it('handles the listing shapes the brief called out', () => {
    expect(classify('Toyota RAV4 or similar').vehicleClass).toBe('MIDSIZE_SUV');
    expect(classify('MG ZS').vehicleClass).toBe('COMPACT_SUV');
    expect(classify('Nissan Qashqai').vehicleClass).toBe('COMPACT_SUV');
    expect(classify('Nissan X-Trail', { vehicleClassRaw: 'Intermediate SUV' }).vehicleClass).toBe('MIDSIZE_SUV');
  });

  it('strips "or similar" before matching', () => {
    expect(classify('Toyota Corolla or similar model').vehicleClass).toBe('COMPACT');
  });

  it('prefers the more specific rule when two patterns overlap', () => {
    expect(classify('Hyundai Kona Electric').vehicleClass).toBe('EV');
    expect(classify('Hyundai Kona').vehicleClass).toBe('COMPACT_SUV');
  });

  it('lets fuel type override the name', () => {
    const result = classify('Some Unknown Wagon', { fuelTypeRaw: 'Electric' });
    expect(result.vehicleClass).toBe('EV');
    expect(result.method).toBe('rule');
  });

  it('promotes a 7-seat SUV to LARGE_SUV', () => {
    expect(classify('Mitsubishi Outlander', { seats: 5 }).vehicleClass).toBe('MIDSIZE_SUV');
    expect(classify('Mitsubishi Outlander', { seats: 7 }).vehicleClass).toBe('LARGE_SUV');
  });

  it('classifies by seat count when the name says nothing', () => {
    expect(classify('Unnamed Shuttle', { seats: 12 }).vehicleClass).toBe('VAN_12_SEAT');
    expect(classify('Unnamed Shuttle', { seats: 10 }).vehicleClass).toBe('VAN_12_SEAT');
  });

  it('reports unresolved instead of guessing', () => {
    const result = classify('Ora Good Cat Lite');
    expect(result.vehicleClass).toBeUndefined();
    expect(result.method).toBe('unresolved');
    expect(result.confidence).toBe(0);
  });

  it('falls back to the source class label when the model is unknown', () => {
    expect(classify('Brand New Thing', { vehicleClassRaw: 'Economy' }).vehicleClass).toBe('ECONOMY');
  });
});

describe('normalizeSupplier', () => {
  it('collapses the same company seen through different channels', () => {
    const variants = ['Avis', 'AVIS Rent a Car', 'Avis Rental Cars NZ', 'avis rent-a-car'];
    const normalized = new Set(variants.map((v) => normalizeSupplier(v)));
    expect(normalized.size).toBe(1);
    expect([...normalized][0]).toBe('avis');
  });

  it('keeps genuinely different suppliers apart', () => {
    expect(normalizeSupplier('Budget NZ')).not.toBe(normalizeSupplier('Thrifty New Zealand'));
  });

  it('returns undefined for nothing', () => {
    expect(normalizeSupplier(undefined)).toBeUndefined();
    expect(normalizeSupplier('  ')).toBeUndefined();
  });
});
