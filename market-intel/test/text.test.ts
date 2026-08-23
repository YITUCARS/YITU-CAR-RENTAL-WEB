import { describe, expect, it } from 'vitest';
import { normalizeKey, parseCurrency, parseMoney, splitOrSimilar } from '../src/utils/text.js';
import { normalizeMileage, normalizeFuelType, normalizeTransmission } from '../src/normalizers/offer.js';

describe('parseMoney', () => {
  it('reads the price formats rental sites actually use', () => {
    expect(parseMoney('NZ$449.00')).toBe(449);
    expect(parseMoney('$1,234.50')).toBe(1234.5);
    expect(parseMoney('1.234,50 EUR')).toBe(1234.5);
    expect(parseMoney('  89 /day ')).toBe(89);
  });

  it('returns undefined rather than a guess', () => {
    expect(parseMoney('Call us')).toBeUndefined();
    expect(parseMoney('')).toBeUndefined();
    expect(parseMoney(undefined)).toBeUndefined();
  });
});

describe('parseCurrency', () => {
  it('recognises symbols and codes, falling back to the query currency', () => {
    expect(parseCurrency('NZ$449.00', 'AUD')).toBe('NZD');
    expect(parseCurrency('AUD 300', 'NZD')).toBe('AUD');
    expect(parseCurrency('449.00', 'NZD')).toBe('NZD');
  });
});

describe('normalizeKey / splitOrSimilar', () => {
  it('makes punctuation-different names comparable', () => {
    expect(normalizeKey('Mazda CX-5')).toBe(normalizeKey('mazda cx 5'));
  });

  it('separates the model from the hedge', () => {
    expect(splitOrSimilar('Toyota RAV4 or similar')).toEqual({ model: 'Toyota RAV4', orSimilar: 'or similar' });
    expect(splitOrSimilar('MG ZS')).toEqual({ model: 'MG ZS' });
  });
});

describe('field normalizers', () => {
  it('reads mileage terms', () => {
    expect(normalizeMileage({ vehicleNameRaw: 'x', mileageLimitRaw: 'Unlimited kilometres' })).toEqual({ unlimited: true });
    expect(normalizeMileage({ vehicleNameRaw: 'x', mileageLimitRaw: '200 km per day' })).toEqual({ unlimited: false, limitKm: 200 });
    expect(normalizeMileage({ vehicleNameRaw: 'x' })).toEqual({});
  });

  it('reads transmission and fuel', () => {
    expect(normalizeTransmission('Automatic')).toBe('automatic');
    expect(normalizeTransmission('5-speed Manual')).toBe('manual');
    expect(normalizeTransmission(undefined)).toBe('unknown');
    expect(normalizeFuelType('Plug-in Hybrid')).toBe('plugin_hybrid');
    expect(normalizeFuelType('Hybrid')).toBe('hybrid');
    expect(normalizeFuelType('Electric')).toBe('electric');
    expect(normalizeFuelType('Petrol')).toBe('petrol');
  });
});
