import type { SearchQuery, VehicleOffer } from '../../models/index.js';
import type { CollectorContext, RentalPriceCollector } from '../types.js';
import { CollectionError } from '../../utils/errors.js';
import { shortHash } from '../../utils/hash.js';
import { sleep } from '../../utils/retry.js';
import { MOCK_FLEET, MOCK_SUPPLIERS } from './fleet.js';
import {
  BASE_DAILY_PRICE,
  durationFactor,
  leadTimeFactor,
  seasonalFactor,
  seededRandom,
  supplierFactor,
} from './pricing-model.js';

const VERSION = '1.0.0';

interface MockOptions {
  supplierCount: number;
  offersPerSearch: number;
  failureRate: number;
  latencyMs: number;
}

function readOptions(raw: Record<string, unknown>): MockOptions {
  return {
    supplierCount: Number(raw.supplier_count ?? 1),
    offersPerSearch: Number(raw.offers_per_search ?? 8),
    failureRate: Number(raw.failure_rate ?? 0),
    latencyMs: Number(raw.latency_ms ?? 120),
  };
}

/**
 * Generates a synthetic but internally consistent market. It touches no
 * network, and it is the reference implementation of the collector contract:
 * a real adapter should look like this, with the generation replaced by
 * extraction.
 *
 * Its prices follow a real booking curve (see pricing-model.ts), so the
 * historical analysis queries can be written and validated before a single
 * competitor has been wired up.
 */
export function createMockCollector(ctx: CollectorContext): RentalPriceCollector {
  const options = readOptions(ctx.source.options);
  const isOta = ctx.source.type === 'ota';

  return {
    id: 'mock',
    version: VERSION,
    capabilities: { oneWay: true, multiSupplier: isOta, requiresBrowser: false },

    async search(query: SearchQuery): Promise<VehicleOffer[]> {
      const seed = [
        ctx.source.code,
        query.pickup.code,
        query.pickupLocal,
        query.durationDays,
        query.leadTimeDays,
      ].join('|');
      const rng = seededRandom(seed);

      // simulate a page load, and occasionally a failure, so the retry /
      // error-artifact paths get exercised without hitting anyone's server
      await sleep(options.latencyMs);
      if (options.failureRate > 0 && rng() < options.failureRate) {
        throw new CollectionError({
          stage: 'parse',
          message: 'Simulated extraction failure (mock failure_rate)',
          url: ctx.source.searchUrl,
          context: { seed },
        });
      }

      const suppliers = isOta
        ? MOCK_SUPPLIERS.slice(0, Math.max(1, options.supplierCount))
        : [ctx.source.name];

      const season = seasonalFactor(query.pickupAt);
      const lead = leadTimeFactor(query.leadTimeDays);
      const duration = durationFactor(query.durationDays);

      const offers: VehicleOffer[] = [];
      for (const supplier of suppliers) {
        const supplierMultiplier = supplierFactor(supplier);
        const fleetSlice = pickFleet(rng, options.offersPerSearch / suppliers.length);

        for (const vehicle of fleetSlice) {
          const base = BASE_DAILY_PRICE[vehicle.expectedClass] ?? 70;
          const noise = 0.93 + rng() * 0.14;
          const daily = round2(base * season * lead * duration * supplierMultiplier * noise);
          const total = round2(daily * query.durationDays);

          // a slice of the fleet is sold out, more often close to pickup
          const soldOutChance = query.leadTimeDays <= 3 ? 0.22 : 0.06;
          const soldOut = rng() < soldOutChance;

          offers.push({
            supplierRaw: supplier,
            channel: isOta ? ctx.source.name : supplier,
            vehicleNameRaw: vehicle.nameRaw,
            vehicleClassRaw: vehicle.classRaw,
            transmissionRaw: vehicle.transmission,
            fuelTypeRaw: vehicle.fuel,
            seats: vehicle.seats,
            bags: vehicle.bags,
            doors: vehicle.doors,
            totalPrice: soldOut ? undefined : total,
            totalPriceRaw: soldOut ? undefined : `NZ$${total.toFixed(2)}`,
            dailyPrice: soldOut ? undefined : daily,
            dailyPriceRaw: soldOut ? undefined : `NZ$${daily.toFixed(2)}/day`,
            currency: 'NZD',
            priceIncludesTaxes: true,
            payType: rng() < 0.5 ? 'prepaid' : 'pay_at_counter',
            availability: soldOut ? 'sold_out' : 'available',
            availabilityRaw: soldOut ? 'Sold out' : 'Available',
            mileageUnlimited: vehicle.seats <= 8,
            mileageLimitKm: vehicle.seats > 8 ? 200 : undefined,
            mileageLimitRaw: vehicle.seats > 8 ? '200 km per day' : 'Unlimited kilometres',
            depositAmount: 200,
            depositRaw: 'NZ$200.00 bond',
            insuranceExcessAmount: vehicle.expectedClass === 'PREMIUM' ? 4000 : 2500,
            insuranceExcessRaw: vehicle.expectedClass === 'PREMIUM' ? 'NZ$4,000 excess' : 'NZ$2,500 excess',
            insuranceProduct: 'Standard cover',
            locationFees: round2(total * 0.06),
            locationFeesRaw: 'Airport concession fee 6%',
            fees: { airport_concession_pct: 6, admin_fee: 0 },
            sourceUrl: `${ctx.source.searchUrl ?? ctx.source.baseUrl}?loc=${query.pickup.sourceLocationCode}&from=${encodeURIComponent(query.pickupLocal)}&days=${query.durationDays}`,
            offerFingerprint: shortHash(seed, supplier, vehicle.nameRaw),
            raw: {
              generator: 'mock',
              seed,
              supplier,
              vehicle,
              factors: { season, lead, duration, supplierMultiplier, noise },
            },
          });
        }
      }
      return offers;
    },
  };
}

function pickFleet(rng: () => number, count: number): typeof MOCK_FLEET {
  const wanted = Math.max(1, Math.min(MOCK_FLEET.length, Math.round(count)));
  const pool = [...MOCK_FLEET];
  // deterministic Fisher-Yates on the seeded rng
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = pool[i]!;
    const b = pool[j]!;
    pool[i] = b;
    pool[j] = a;
  }
  return pool.slice(0, wanted);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
