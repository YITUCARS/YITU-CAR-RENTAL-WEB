import { describe, expect, it, beforeAll } from 'vitest';
import { loadConfig } from '../src/config/load.js';
import type { AppConfig, SourceConfig } from '../src/config/types.js';
import { createMockCollector } from '../src/collectors/mock/mock-collector.js';
import { resolveQueryLocation, type SearchQuery } from '../src/models/search-query.js';
import { normalizeOffer } from '../src/normalizers/offer.js';
import { VehicleClassifier, FALLBACK_RULES } from '../src/normalizers/vehicle-class.js';
import { ArtifactStore } from '../src/utils/artifacts.js';
import { logger } from '../src/utils/logger.js';

let config: AppConfig;

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://localhost:5432/unused_in_this_test';
  config = loadConfig({ skipDotenv: true });
});

function buildQuery(source: SourceConfig, leadTimeDays: number, durationDays: number): SearchQuery {
  const location = config.locations.find((l) => l.code === 'CHC_APT')!;
  const pickup = resolveQueryLocation(source, location)!;
  const pickupAt = new Date(Date.now() + leadTimeDays * 86_400_000);
  const returnAt = new Date(pickupAt.getTime() + durationDays * 86_400_000);
  return {
    runId: '00000000-0000-0000-0000-000000000000',
    jobId: 1,
    source,
    pickup,
    dropoff: pickup,
    pickupAt,
    returnAt,
    pickupLocal: '2026-11-20 10:00:00',
    returnLocal: '2026-11-25 10:00:00',
    leadTimeDays,
    durationDays,
    driverAge: 30,
    currency: 'NZD',
    observedAt: new Date(),
  };
}

function collectorFor(code: string) {
  const source = config.sources.find((s) => s.code === code)!;
  return {
    source,
    collector: createMockCollector({
      source,
      config,
      log: logger,
      artifacts: new ArtifactStore(config.env.artifactsDir),
      dryRun: true,
    }),
  };
}

describe('mock collector', () => {
  it('returns offers with the fields the schema requires', async () => {
    const { source, collector } = collectorFor('mock_direct');
    const offers = await collector.search(buildQuery(source, 30, 5));

    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.vehicleNameRaw).toBeTruthy();
      expect(offer.currency).toBe('NZD');
      expect(offer.raw).toBeTruthy();
      expect(offer.sourceUrl).toContain('CHC');
      if (offer.availability === 'available') expect(offer.dailyPrice).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same query', async () => {
    const { source, collector } = collectorFor('mock_direct');
    const a = await collector.search(buildQuery(source, 30, 5));
    const b = await collector.search(buildQuery(source, 30, 5));
    expect(a.map((o) => o.dailyPrice)).toEqual(b.map((o) => o.dailyPrice));
  });

  it('reproduces the booking curve: closer pickup, higher price', async () => {
    const { source, collector } = collectorFor('mock_direct');
    const median = async (leadTimeDays: number) => {
      const offers = await collector.search(buildQuery(source, leadTimeDays, 5));
      const prices = offers
        .filter((o) => o.availability === 'available' && o.dailyPrice)
        .map((o) => o.dailyPrice!)
        .sort((a, b) => a - b);
      return prices[Math.floor(prices.length / 2)]!;
    };
    expect(await median(1)).toBeGreaterThan(await median(90));
  });

  it('an OTA reports several suppliers under one channel', async () => {
    const { source, collector } = collectorFor('mock_ota');
    const offers = await collector.search(buildQuery(source, 30, 5));
    const suppliers = new Set(offers.map((o) => o.supplierRaw));
    const channels = new Set(offers.map((o) => o.channel));
    expect(suppliers.size).toBeGreaterThan(1);
    expect(channels.size).toBe(1);
  });
});

describe('normalizeOffer', () => {
  const classifier = new VehicleClassifier(FALLBACK_RULES);

  it('keeps supplier and channel separate for OTA offers', async () => {
    const { source, collector } = collectorFor('mock_ota');
    const query = buildQuery(source, 30, 5);
    const offers = await collector.search(query);
    const avis = offers.find((o) => o.supplierRaw === 'Avis')!;

    const { observation } = normalizeOffer(query, avis, classifier, '1.0.0');
    expect(observation.supplier).toBe('avis');
    expect(observation.channel).toBe(source.name);
    expect(observation.sourceType).toBe('ota');
  });

  it('derives the missing side of total vs daily price', () => {
    const source = config.sources.find((s) => s.code === 'mock_direct')!;
    const query = buildQuery(source, 30, 5);

    const fromTotal = normalizeOffer(query, { vehicleNameRaw: 'Toyota RAV4 or similar', totalPriceRaw: 'NZ$500.00' }, classifier).observation;
    expect(fromTotal.totalPrice).toBe(500);
    expect(fromTotal.dailyPrice).toBe(100);

    const fromDaily = normalizeOffer(query, { vehicleNameRaw: 'Toyota RAV4 or similar', dailyPriceRaw: 'NZ$100.00/day' }, classifier).observation;
    expect(fromDaily.dailyPrice).toBe(100);
    expect(fromDaily.totalPrice).toBe(500);
  });

  it('keeps the raw string when a price cannot be parsed', () => {
    const source = config.sources.find((s) => s.code === 'mock_direct')!;
    const query = buildQuery(source, 30, 5);
    const { observation } = normalizeOffer(query, { vehicleNameRaw: 'Toyota RAV4', totalPriceRaw: 'Call for a quote' }, classifier);
    expect(observation.totalPrice).toBeUndefined();
    expect(observation.totalPriceRaw).toBe('Call for a quote');
  });

  it('flags unclassifiable vehicles for review rather than guessing', () => {
    const source = config.sources.find((s) => s.code === 'mock_direct')!;
    const query = buildQuery(source, 30, 5);
    const result = normalizeOffer(query, { vehicleNameRaw: 'Ora Good Cat Lite', dailyPrice: 70 }, classifier);
    expect(result.observation.vehicleClass).toBeUndefined();
    expect(result.observation.vehicleClassMethod).toBe('unresolved');
    expect(result.unresolved?.normalizedKey).toBe('ora good cat lite');
  });
});
