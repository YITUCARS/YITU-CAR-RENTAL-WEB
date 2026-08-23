import type { FuelType, Transmission } from '../../models/vehicle-class.js';

/**
 * ACRISS / SIPP codes (RCM calls the field `sippcode`, e.g. 'EDAV', 'SFDV').
 *
 * Four letters: category, body type, transmission+drive, fuel+aircon. The
 * third and fourth letters are mechanical facts an operator has little reason
 * to get wrong, so we trust them for transmission and fuel. The first two are
 * a marketing judgement and operators do bend them, so they feed the class
 * mapping only as a fallback, below the vehicle name.
 */

export interface AcrissParts {
  category?: string;
  bodyType?: string;
  transmission?: Transmission;
  drive?: 'two_wheel' | 'four_wheel' | 'all_wheel';
  fuelType?: FuelType;
  airCon?: boolean;
}

const TRANSMISSION: Record<string, { transmission: Transmission; drive?: AcrissParts['drive'] }> = {
  M: { transmission: 'manual' },
  N: { transmission: 'manual', drive: 'four_wheel' },
  C: { transmission: 'manual', drive: 'all_wheel' },
  A: { transmission: 'automatic' },
  B: { transmission: 'automatic', drive: 'four_wheel' },
  D: { transmission: 'automatic', drive: 'all_wheel' },
};

const FUEL: Record<string, { fuelType: FuelType; airCon: boolean }> = {
  R: { fuelType: 'unknown', airCon: true },
  N: { fuelType: 'unknown', airCon: false },
  D: { fuelType: 'diesel', airCon: true },
  Q: { fuelType: 'diesel', airCon: false },
  H: { fuelType: 'hybrid', airCon: true },
  I: { fuelType: 'hybrid', airCon: false },
  E: { fuelType: 'electric', airCon: true },
  C: { fuelType: 'electric', airCon: true },
  L: { fuelType: 'unknown', airCon: true },
  V: { fuelType: 'petrol', airCon: true },
  Z: { fuelType: 'petrol', airCon: false },
  U: { fuelType: 'petrol', airCon: true },
};

const CATEGORY: Record<string, string> = {
  M: 'mini', N: 'mini elite', E: 'economy', H: 'economy elite', C: 'compact',
  D: 'compact elite', I: 'intermediate', J: 'intermediate elite', S: 'standard',
  R: 'standard elite', F: 'fullsize', G: 'fullsize elite', P: 'premium',
  U: 'premium elite', L: 'luxury', W: 'luxury elite', O: 'oversize', X: 'special',
};

const BODY: Record<string, string> = {
  B: '2-3 door', C: '2/4 door', D: '4-5 door', W: 'wagon', V: 'passenger van',
  L: 'limousine', S: 'sport', T: 'convertible', F: 'suv', J: 'open air',
  X: 'special', P: 'pickup', Q: 'pickup extended', Z: 'special offer',
  E: 'coupe', M: 'monospace', R: 'recreational', H: 'motorhome', Y: '2 wheel',
  N: 'roadster', G: 'crossover', K: 'commercial van',
};

export function parseAcriss(code: string | undefined | null): AcrissParts {
  if (!code) return {};
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(c)) return {};

  const transmission = TRANSMISSION[c[2]!];
  const fuel = FUEL[c[3]!];

  return {
    category: CATEGORY[c[0]!],
    bodyType: BODY[c[1]!],
    transmission: transmission?.transmission,
    drive: transmission?.drive,
    fuelType: fuel?.fuelType,
    airCon: fuel?.airCon,
  };
}

/**
 * A class label derived from the code, fed to the normalizer as
 * `vehicleClassRaw` when the source gives us nothing better. 'SFDV' becomes
 * 'standard suv', which the existing mapping rules already understand.
 */
export function acrissClassHint(code: string | undefined | null): string | undefined {
  const parts = parseAcriss(code);
  if (!parts.category) return undefined;
  const body = parts.bodyType;
  if (body === 'suv' || body === 'crossover') return `${parts.category} suv`;
  if (body === 'passenger van' || body === 'commercial van' || body === 'monospace') {
    return `${parts.category} van`;
  }
  return parts.category;
}
