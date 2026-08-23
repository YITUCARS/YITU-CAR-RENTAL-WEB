import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb } from './helpers/pglite-db.js';
import { migrate } from '../src/database/migrate.js';
import { observationsRepo } from '../src/database/repositories/index.js';
import type { Db } from '../src/database/client.js';
import { loadConfig } from '../src/config/load.js';
import type { AppConfig } from '../src/config/types.js';
import { VehicleClassifier, toMappingRule } from '../src/normalizers/vehicle-class.js';
import { normalizeOffer } from '../src/normalizers/offer.js';
import { resolveQueryLocation, type SearchQuery } from '../src/models/search-query.js';
import type { VehicleOffer } from '../src/models/vehicle-offer.js';
import { parseAcriss, acrissClassHint } from '../src/collectors/rcm/acriss.js';
import { planJobs, windowPickupDates } from '../src/jobs/generate.js';
import { formatLocalDate } from '../src/utils/dates.js';

/**
 * Regression tests against real captured responses from Yes Rentals
 * (Christchurch Airport). The fixtures are exactly what the live site returned
 * on 2026-08-23 via `npm run mi -- probe --out=...`.
 *
 * If the site changes shape, or a mapping rule regresses, these fail without
 * anyone having to hit their servers.
 */

interface Fixture {
  source: string;
  capturedAt: string;
  query: { pickupLocal: string; returnLocal: string; durationDays: number };
  offers: VehicleOffer[];
}

const load = (name: string): Fixture =>
  JSON.parse(readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')) as Fixture;

const peak = load('yes-rentals-chc-2027-02-10.json');   // 171 days out, Feb peak
const shoulder = load('yes-rentals-chc-2026-09-20.json'); // 28 days out, low season

let db: Db;
let close: () => Promise<void>;
let config: AppConfig;
let classifier: VehicleClassifier;

beforeAll(async () => {
  process.env.DATABASE_URL ??= 'postgresql://localhost:5432/unused';
  config = loadConfig({ skipDotenv: true });
  ({ db, close } = await createTestDb());
  await migrate(db);
  const rules = await observationsRepo.loadMappingRules(db);
  classifier = new VehicleClassifier(rules.map(toMappingRule));
}, 60_000);

afterAll(async () => {
  await close?.();
});

function queryFor(fixture: Fixture): SearchQuery {
  const source = config.sources.find((s) => s.code === 'yes_rentals')!;
  const location = config.locations.find((l) => l.code === 'CHC_APT')!;
  const pickupLocation = resolveQueryLocation(source, location)!;
  const pickupAt = new Date(`${fixture.query.pickupLocal.replace(' ', 'T')}+13:00`);
  return {
    runId: '00000000-0000-0000-0000-000000000000',
    source,
    pickup: pickupLocation,
    dropoff: pickupLocation,
    pickupAt,
    returnAt: new Date(pickupAt.getTime() + fixture.query.durationDays * 86_400_000),
    pickupLocal: fixture.query.pickupLocal,
    returnLocal: fixture.query.returnLocal,
    leadTimeDays: 30,
    durationDays: fixture.query.durationDays,
    driverAge: 30,
    currency: 'NZD',
    observedAt: new Date(fixture.capturedAt),
  };
}

describe('Yes Rentals extraction', () => {
  it('captured a full result set from the live site', () => {
    expect(peak.offers.length).toBe(21);
    expect(shoulder.offers.length).toBe(21);
  });

  it('keeps raw and parsed values side by side', () => {
    const priced = peak.offers.find((o) => o.availability === 'available')!;
    expect(priced.dailyPriceRaw).toMatch(/^NZ\$[\d.]+\/day$/);
    expect(priced.totalPriceRaw).toMatch(/^NZ\$[\d.]+$/);
    expect(priced.dailyPrice).toBeGreaterThan(0);
    expect(priced.currency).toBe('NZD');
    expect(priced.raw).toBeTruthy();
  });

  it('records sold-out vehicles without inventing a price', () => {
    const soldOut = peak.offers.filter((o) => o.availability === 'sold_out');
    expect(soldOut.length).toBeGreaterThan(0);
    for (const offer of soldOut) {
      expect(offer.dailyPrice).toBeUndefined();
      expect(offer.totalPrice).toBeUndefined();
      expect(offer.vehicleNameRaw).toBeTruthy();
    }
  });

  it('reads total and daily prices that agree with the rental length', () => {
    for (const offer of peak.offers.filter((o) => o.availability === 'available')) {
      expect(offer.totalPrice).toBeCloseTo(offer.dailyPrice! * peak.query.durationDays, 2);
    }
  });

  it('carries the ACRISS code through for every vehicle', () => {
    for (const offer of peak.offers) {
      expect(offer.acrissCode).toMatch(/^[A-Z]{4}$/);
    }
  });
});

describe('ACRISS parsing', () => {
  it('decodes the codes this site actually uses', () => {
    expect(parseAcriss('EDAV')).toMatchObject({ category: 'economy', bodyType: '4-5 door', transmission: 'automatic', fuelType: 'petrol' });
    expect(parseAcriss('SFDV')).toMatchObject({ category: 'standard', bodyType: 'suv', transmission: 'automatic', drive: 'all_wheel' });
    expect(parseAcriss('EDAH')).toMatchObject({ fuelType: 'hybrid' });
    expect(parseAcriss('PVAD')).toMatchObject({ bodyType: 'passenger van', fuelType: 'diesel' });
    expect(parseAcriss('nonsense')).toEqual({});
  });

  it('turns a code into a class hint the mapping table understands', () => {
    expect(acrissClassHint('SFDV')).toBe('standard suv');
    expect(acrissClassHint('FVAV')).toBe('fullsize van');
    expect(acrissClassHint('EDAV')).toBe('economy');
  });
});

describe('classification of the real fleet', () => {
  const classifyAll = (fixture: Fixture) => {
    const query = queryFor(fixture);
    return fixture.offers.map((offer) => ({
      name: offer.vehicleNameRaw,
      ...normalizeOffer(query, offer, classifier, '1.0.0'),
    }));
  };

  it('classifies every vehicle the site offers', () => {
    const results = classifyAll(peak);
    const unresolved = results.filter((r) => r.observation.vehicleClass === undefined);
    expect(unresolved.map((u) => u.name)).toEqual([]);
  });

  it('puts each vehicle in the class a human would', () => {
    const byName = new Map(classifyAll(peak).map((r) => [r.name, r.observation.vehicleClass]));
    const expected: Record<string, string> = {
      'Mazda Demio Hatchback or Similar': 'ECONOMY',
      'Toyota Vitz Hatchback or Similar': 'ECONOMY',
      'Toyota Yaris or Similar': 'ECONOMY',
      'Toyota Corolla Hatchback or Similar': 'COMPACT',
      'Toyota Camry Comfort Sedan or Similar': 'MIDSIZE',
      'Nissan Teana / Similar': 'MIDSIZE',
      'Toyota RAV4 2016-2018 4WD / Similar': 'MIDSIZE_SUV',
      'Toyota Highlander 2015-2018 or Similar': 'LARGE_SUV',
      'Toyota Alphard 7 seats or Similar': 'VAN_8_SEAT',
      'Benz Valente 6 Seats 2018': 'VAN_8_SEAT',
    };
    for (const [name, cls] of Object.entries(expected)) {
      expect(byName.get(name), `${name} should be ${cls}`).toBe(cls);
    }
  });

  it('uses seat count to separate people movers from minibuses', () => {
    const byName = new Map(classifyAll(peak).map((r) => [r.name, r.observation]));
    const hiace12 = [...byName.entries()].find(([n]) => n.includes('12 Seaters'))![1];
    const hiace10 = [...byName.entries()].find(([n]) => n.includes('2022 - 2023'))![1];
    expect(hiace12.vehicleClass).toBe('VAN_12_SEAT');
    expect(hiace10.seats).toBe(10);
    expect(hiace10.vehicleClass).toBe('VAN_12_SEAT');
    expect(byName.get('Toyota Alphard 7 seats or Similar')!.seats).toBe(7);
  });

  it('reads transmission and fuel from the ACRISS code', () => {
    const results = classifyAll(peak);
    const aqua = results.find((r) => r.name.includes('Aqua'))!.observation;
    expect(aqua.fuelType).toBe('hybrid');
    expect(aqua.transmission).toBe('automatic');
    expect(results.every((r) => r.observation.transmission !== 'unknown')).toBe(true);
  });

  it('classifies the shoulder-season capture identically', () => {
    const peakClasses = new Map(classifyAll(peak).map((r) => [r.name, r.observation.vehicleClass]));
    for (const r of classifyAll(shoulder)) {
      expect(r.observation.vehicleClass).toBe(peakClasses.get(r.name));
    }
  });
});

describe('what the two captures say about the market', () => {
  const dailyFor = (fixture: Fixture, match: string): number | undefined =>
    fixture.offers.find((o) => o.vehicleNameRaw.includes(match) && o.availability === 'available')?.dailyPrice;

  it('shows February priced far above September for the same car', () => {
    const demioPeak = dailyFor(peak, 'Demio')!;
    const demioShoulder = dailyFor(shoulder, 'Demio')!;
    expect(demioPeak).toBeGreaterThan(demioShoulder * 5);
  });

  it('shows the class spread compressing in February, which is why it needs watching', () => {
    // September: an SUV costs ~3x an economy car. February: ~1.1x. A spread
    // that flat is the signature of an untuned peak rate, not a real market.
    const spread = (f: Fixture) => dailyFor(f, 'RAV4')! / dailyFor(f, 'Demio')!;
    expect(spread(shoulder)).toBeGreaterThan(2.5);
    expect(spread(peak)).toBeLessThan(1.5);
  });
});

describe('February 2027 target window', () => {
  it('samples pickup dates across the whole month', () => {
    const window = config.targetWindows.find((w) => w.code === 'feb_2027')!;
    const dates = windowPickupDates(window);
    expect(dates.length).toBe(10);
    // local calendar dates, not UTC instants
    expect(formatLocalDate(dates[0]!)).toBe('2027-02-01');
    expect(formatLocalDate(dates.at(-1)!)).toBe('2027-02-28');
  });

  it('enqueues those dates even though they are past the 90-day rolling grid', () => {
    const plan = planJobs(config, { sourceCodes: ['yes_rentals'], now: new Date('2026-08-23T22:00:00Z') });
    const febJobs = plan.jobs.filter((j) => j.pickupLocal.startsWith('2027-02'));
    expect(febJobs.length).toBe(30); // 10 dates x 3 durations
    expect(febJobs.every((j) => j.leadTimeDays > 90)).toBe(true);
    expect(new Set(febJobs.map((j) => j.dedupeKey)).size).toBe(30);
  });
});
