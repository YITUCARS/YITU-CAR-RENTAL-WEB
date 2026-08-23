import type {
  Availability,
  FuelType,
  PayType,
  Transmission,
  VehicleClass,
  ClassificationMethod,
} from './vehicle-class.js';

/**
 * What a collector returns: one bookable offer, as close to what the page said
 * as possible.
 *
 * The contract is raw-first. A collector's job is to read the page accurately,
 * not to interpret it. Every field that exists in two forms keeps the raw
 * string (`totalPriceRaw: 'NZ$449.00'`) alongside the parsed number, because a
 * parsing rule we get wrong today can be re-run over the raw values later,
 * while a discarded string is gone forever. `raw` holds the whole extracted
 * record for the same reason.
 */
export interface VehicleOffer {
  // ---- who is selling -------------------------------------------------------
  /** the rental company actually providing the car, as displayed */
  supplierRaw?: string;
  /** OTA name when the source resells, otherwise left to the normalizer */
  channel?: string;

  // ---- the vehicle ----------------------------------------------------------
  /** exactly as shown: 'Toyota RAV4 or similar' */
  vehicleNameRaw: string;
  /** the source's own category label: 'Intermediate SUV' */
  vehicleClassRaw?: string;
  /** ACRISS/SIPP code when the source publishes one */
  acrissCode?: string;
  transmissionRaw?: string;
  transmission?: Transmission;
  fuelTypeRaw?: string;
  fuelType?: FuelType;
  seats?: number;
  bags?: number;
  doors?: number;

  // ---- price ----------------------------------------------------------------
  totalPriceRaw?: string;
  totalPrice?: number;
  dailyPriceRaw?: string;
  dailyPrice?: number;
  currency?: string;
  priceIncludesTaxes?: boolean;
  payType?: PayType;

  // ---- terms ----------------------------------------------------------------
  availability?: Availability;
  availabilityRaw?: string;
  mileageLimitRaw?: string;
  mileageUnlimited?: boolean;
  mileageLimitKm?: number;
  depositRaw?: string;
  depositAmount?: number;
  insuranceExcessRaw?: string;
  insuranceExcessAmount?: number;
  insuranceProduct?: string;
  locationFeesRaw?: string;
  locationFees?: number;
  /** itemised fee breakdown when the page shows one */
  fees?: Record<string, unknown>;

  // ---- provenance -----------------------------------------------------------
  /** deep link to this offer, or the results URL if there is no deep link */
  sourceUrl?: string;
  /** stable id within one search result set; used to spot duplicate cards */
  offerFingerprint?: string;
  /** the untouched extracted record — API payload or scraped field bag */
  raw?: Record<string, unknown>;
}

/**
 * A fully normalized row, ready to be written to
 * market_intel.market_price_observations. Built by the normalizer from
 * (SearchQuery + VehicleOffer); collectors never construct this themselves.
 */
export interface MarketPriceObservation {
  jobId?: number;
  runId: string;
  observedAt: Date;

  sourceCode: string;
  sourceType: 'direct' | 'ota';
  channel: string;
  supplier?: string;
  supplierRaw?: string;

  pickupLocationCode: string;
  returnLocationCode: string;
  pickupLocationRaw?: string;
  returnLocationRaw?: string;
  pickupDatetime: Date;
  returnDatetime: Date;
  pickupDatetimeLocal: string;
  returnDatetimeLocal: string;
  leadTimeDays: number;
  durationDays: number;

  vehicleNameRaw: string;
  vehicleOrSimilarText?: string;
  vehicleClassRaw?: string;
  vehicleClass?: VehicleClass;
  vehicleClassMethod: ClassificationMethod;
  vehicleClassConfidence?: number;
  acrissCode?: string;
  transmission: Transmission;
  transmissionRaw?: string;
  fuelType: FuelType;
  fuelTypeRaw?: string;
  seats?: number;
  bags?: number;
  doors?: number;

  currency: string;
  totalPrice?: number;
  dailyPrice?: number;
  totalPriceRaw?: string;
  dailyPriceRaw?: string;
  priceIncludesTaxes?: boolean;
  payType?: PayType;

  availability: Availability;
  availabilityRaw?: string;
  mileageUnlimited?: boolean;
  mileageLimitKm?: number;
  mileageLimitRaw?: string;
  depositAmount?: number;
  depositRaw?: string;
  insuranceExcessAmount?: number;
  insuranceExcessRaw?: string;
  insuranceProduct?: string;
  locationFees?: number;
  locationFeesRaw?: string;
  fees?: Record<string, unknown>;

  sourceUrl?: string;
  offerFingerprint?: string;
  collectorVersion?: string;
  raw: Record<string, unknown>;
}
