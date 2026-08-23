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

/**
 * Regression tests against a real captured response from A Rentals
 * (Christchurch, 2026-09-20, 5 days), taken with
 * `npm run mi -- probe --source=a_rentals --out=...`.
 */

interface Fixture {
  source: string;
  capturedAt: string;
  query: { pickupLocal: string; returnLocal: string; durationDays: number };
  offers: VehicleOffer[];
}

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'a-rentals-chc-2026-09-20.json'), 'utf8'),
) as Fixture;

let db: Db;
let close: () => Promise<void>;
let config: AppConfig;
let classifier: VehicleClassifier;

beforeAll(async () => {
  process.env.DATABASE_URL ??= 'postgresql://localhost:5432/unused';
  config = loadConfig({ skipDotenv: true });
  ({ db, close } = await createTestDb());
  await migrate(db);
  classifier = new VehicleClassifier((await observationsRepo.loadMappingRules(db)).map(toMappingRule));
}, 60_000);

afterAll(async () => { await close?.(); });

function query(): SearchQuery {
  const source = config.sources.find((s) => s.code === 'a_rentals')!;
  const location = config.locations.find((l) => l.code === 'CHC_APT')!;
  const loc = resolveQueryLocation(source, location)!;
  const pickupAt = new Date(`${fixture.query.pickupLocal.replace(' ', 'T')}+12:00`);
  return {
    runId: '00000000-0000-0000-0000-000000000000',
    source, pickup: loc, dropoff: loc,
    pickupAt,
    returnAt: new Date(pickupAt.getTime() + fixture.query.durationDays * 86_400_000),
    pickupLocal: fixture.query.pickupLocal,
    returnLocal: fixture.query.returnLocal,
    leadTimeDays: 28,
    durationDays: fixture.query.durationDays,
    driverAge: 30, currency: 'NZD',
    observedAt: new Date(fixture.capturedAt),
  };
}

const normalized = () => fixture.offers.map((o) => normalizeOffer(query(), o, classifier, '1.0.0'));

describe('A Rentals extraction', () => {
  it('captured the whole fleet', () => {
    expect(fixture.offers.length).toBe(23);
  });

  it('reads a rental total and lets the normalizer derive the daily rate', () => {
    const aqua = fixture.offers.find((o) => o.vehicleNameRaw.includes('Aqua Hybrid or Similar'))!;
    expect(aqua.totalPrice).toBe(129.7);
    expect(aqua.dailyPrice).toBeUndefined(); // the site never states one

    const obs = normalizeOffer(query(), aqua, classifier, '1.0.0').observation;
    expect(obs.totalPrice).toBe(129.7);
    expect(obs.dailyPrice).toBeCloseTo(25.94, 2);
  });

  it('keeps the prepaid rate without letting it replace the standard one', () => {
    const aqua = fixture.offers.find((o) => o.vehicleNameRaw.includes('Aqua Hybrid or Similar'))!;
    const pricing = (aqua.raw as { pricing: { prepaidTotal: number; prepaidDiscount: number } }).pricing;
    // 5% off for prepaying — stored, but the comparable headline rate wins
    expect(pricing.prepaidTotal).toBe(123.2);
    expect(pricing.prepaidDiscount).toBeCloseTo(5, 1);
    expect(aqua.totalPrice).toBeGreaterThan(pricing.prepaidTotal);
  });

  it('marks unbookable vehicles sold out rather than free', () => {
    const soldOut = fixture.offers.filter((o) => o.availability === 'sold_out');
    expect(soldOut.length).toBeGreaterThan(10);
    for (const o of soldOut) {
      expect(o.totalPrice).toBeUndefined();
      expect(o.dailyPrice).toBeUndefined();
    }
  });
});

describe('classification of the A Rentals fleet', () => {
  it('classifies every vehicle', () => {
    const unresolved = normalized().filter((r) => r.observation.vehicleClass === undefined);
    expect(unresolved.map((u) => u.observation.vehicleNameRaw)).toEqual([]);
  });

  it('does not let a brand or trim word outrank the category label', () => {
    // these were PREMIUM before the classifier compared all text sources by
    // priority: "premium" and "mercedes" are priority-90 fallbacks, while the
    // site's own "mpv" category is a far better signal
    const byName = new Map(normalized().map((r) => [r.observation.vehicleNameRaw, r.observation.vehicleClass]));
    expect(byName.get('Hyundai Staria Premiums AWD')).toBe('VAN_8_SEAT');
    expect(byName.get('Mercedes Vito-Tourer (New)')).toBe('VAN_8_SEAT');
    expect(byName.get('Hyundai Staria 2WD or Similar')).toBe('VAN_8_SEAT');
  });

  it('places the rest where a human would', () => {
    const byName = new Map(normalized().map((r) => [r.observation.vehicleNameRaw, r.observation.vehicleClass]));
    const expected: Record<string, string> = {
      'Toyota Aqua Hybrid or Similar': 'ECONOMY',
      'Toyota Prius Hybrid or Similar': 'COMPACT',
      'Toyota RAV4 2019 or Similar': 'MIDSIZE_SUV',
      'Mitsubishi Outlander or Similar': 'LARGE_SUV',   // 7 seats promotes it
      'Toyota Highlander Hybrid': 'LARGE_SUV',
      'Mercedes Valente or Similar': 'VAN_8_SEAT',
      'Mercedes Sprinter (New)': 'VAN_12_SEAT',
      'MITSUBISHI ASX or Similar': 'COMPACT_SUV',
    };
    for (const [name, cls] of Object.entries(expected)) {
      expect(byName.get(name), `${name} should be ${cls}`).toBe(cls);
    }
  });

  it('reads hybrids as hybrid', () => {
    const aqua = normalized().find((r) => r.observation.vehicleNameRaw.includes('Aqua Hybrid or Similar'))!;
    expect(aqua.observation.fuelType).toBe('hybrid');
  });
});

describe('the two competitors are comparable', () => {
  it('quotes a similar daily rate for the same car on the same dates', () => {
    // Yes Rentals, CHC, 2026-09-20, 5 days: Toyota Aqua at NZ$26/day
    const yes = JSON.parse(
      readFileSync(path.join(__dirname, 'fixtures', 'yes-rentals-chc-2026-09-20.json'), 'utf8'),
    ) as Fixture;
    const yesAqua = yes.offers.find((o) => o.vehicleNameRaw.includes('Aqua'))!;
    const ourAqua = normalizeOffer(
      query(),
      fixture.offers.find((o) => o.vehicleNameRaw.includes('Aqua Hybrid or Similar'))!,
      classifier,
      '1.0.0',
    ).observation;

    expect(yesAqua.dailyPrice).toBeGreaterThan(0);
    expect(ourAqua.dailyPrice).toBeGreaterThan(0);
    // within 25% of each other — this is what makes a market median meaningful
    const ratio = ourAqua.dailyPrice! / yesAqua.dailyPrice!;
    expect(ratio).toBeGreaterThan(0.75);
    expect(ratio).toBeLessThan(1.25);
  });
});
