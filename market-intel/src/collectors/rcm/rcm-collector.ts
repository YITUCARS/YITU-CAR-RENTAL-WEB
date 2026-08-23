import type { Page } from 'playwright';
import type { SearchQuery, VehicleOffer } from '../../models/index.js';
import type { CollectorContext, RentalPriceCollector } from '../types.js';
import { BrowserSession } from '../browser.js';
import { CollectionError } from '../../utils/errors.js';
import { shortHash } from '../../utils/hash.js';
import { acrissClassHint, parseAcriss } from './acriss.js';
import type { RcmAvailableCar, RcmPageState } from './types.js';

const VERSION = '1.0.0';

/**
 * Rental Car Manager (RCM) v3.2 booking engine.
 *
 * RCM powers a large share of New Zealand's independent rental fleet, so this
 * is written against the engine rather than against one company: a second RCM
 * competitor is a sources.yaml entry, not new code. Per-site differences
 * (which page hosts the search form, the location ids, field names) are all
 * config.
 *
 * How it reads prices: RCM renders its results from a JavaScript array the
 * page itself publishes, `window.rcmAvailableCars`. We fill in the site's own
 * public search form, let their server answer it, and read that array. This is
 * strictly what the page shows an ordinary visitor — we do not call RCM's
 * signed API, because those signatures are the operator's own credentials and
 * forging them would be accessing an account that is not ours.
 */

interface RcmOptions {
  formUrl: string;
  resultsPath: string;
  dateFormat: 'd/m/Y';
  driverAgeValue?: string;
  liveInCountryValue?: string;
  categoryTypeValue?: string;
  waitAfterSubmitMs: number;
  fields: {
    pickupLocation: string;
    dropoffLocation: string;
    pickupDate: string;
    pickupTime: string;
    dropoffDate: string;
    dropoffTime: string;
    minimumAge: string;
    liveInCountry: string;
    categoryType: string;
  };
}

function readOptions(ctx: CollectorContext): RcmOptions {
  const raw = ctx.source.options as Record<string, unknown>;
  const fields = (raw.fields ?? {}) as Record<string, string>;
  const formUrl = String(raw.form_url ?? ctx.source.searchUrl ?? ctx.source.baseUrl);
  return {
    formUrl,
    resultsPath: String(raw.results_path ?? '/rcmv2/step2'),
    dateFormat: 'd/m/Y',
    driverAgeValue: raw.driver_age_value ? String(raw.driver_age_value) : undefined,
    liveInCountryValue: raw.livein_country_value ? String(raw.livein_country_value) : undefined,
    categoryTypeValue: raw.category_type_value ? String(raw.category_type_value) : undefined,
    waitAfterSubmitMs: Number(raw.wait_after_submit_ms ?? 12_000),
    fields: {
      pickupLocation: fields.pickup_location ?? 'form-Pickup-Location',
      dropoffLocation: fields.dropoff_location ?? 'form-Dropoff-Location',
      pickupDate: fields.pickup_date ?? 'form-Pickup-Date',
      pickupTime: fields.pickup_time ?? 'form-Pickup-Time',
      dropoffDate: fields.dropoff_date ?? 'form-Dropoff-Date',
      dropoffTime: fields.dropoff_time ?? 'form-Dropoff-Time',
      minimumAge: fields.minimum_age ?? 'form-Minimum-Age',
      liveInCountry: fields.livein_country ?? 'form-LiveIn-Country',
      categoryType: fields.category_type ?? 'form-Category-Type',
    },
  };
}

/** '2027-02-10 10:00:00' -> { date: '10/02/2027', time: '10:00' } */
function splitLocal(local: string): { date: string; time: string } {
  const [datePart = '', timePart = '00:00:00'] = local.split(' ');
  const [y, m, d] = datePart.split('-');
  return { date: `${d}/${m}/${y}`, time: timePart.slice(0, 5) };
}

export function createRcmCollector(ctx: CollectorContext): RentalPriceCollector {
  const options = readOptions(ctx);
  const session = new BrowserSession(ctx.log, { timeoutMs: ctx.source.timeoutMs });

  const collector: RentalPriceCollector & {
    captureFailureState: () => Promise<{ screenshot?: Buffer; html?: string }>;
  } = {
    id: 'rcm',
    version: VERSION,
    capabilities: { oneWay: true, multiSupplier: false, requiresBrowser: true },

    async init() {
      if (ctx.dryRun) return;
      await session.launch();
    },

    async dispose() {
      await session.close();
    },

    captureFailureState: () => session.capture(),

    async search(query: SearchQuery): Promise<VehicleOffer[]> {
      if (ctx.dryRun) {
        throw new CollectionError({
          stage: 'config',
          retryable: false,
          message: 'DRY_RUN is set; the RCM collector will not touch the network',
        });
      }

      const state = await session.withPage((page) => runSearch(page, query, options, ctx));
      return state.cars.map((car) => toOffer(car, state, query));
    },
  };

  return collector;
}

async function runSearch(
  page: Page,
  query: SearchQuery,
  options: RcmOptions,
  ctx: CollectorContext,
): Promise<RcmPageState> {
  const pickup = splitLocal(query.pickupLocal);
  const dropoff = splitLocal(query.returnLocal);

  await page.goto(options.formUrl, { waitUntil: 'domcontentloaded' });

  // The location dropdowns are filled in by RCM's script after load; until they
  // have options there is nothing to submit.
  const formSelector = 'form[name="frmStep1"]';
  try {
    await page.waitForFunction(
      ([sel, locField]) => {
        const form = document.querySelector<HTMLFormElement>(sel as string);
        if (!form) return false;
        const el = form.elements.namedItem(locField as string) as HTMLSelectElement | null;
        return !!el && el.options.length > 1;
      },
      [formSelector, options.fields.pickupLocation],
      { timeout: ctx.source.timeoutMs },
    );
  } catch {
    throw new CollectionError({
      stage: 'navigate',
      message: 'RCM search form never finished loading its locations',
      url: options.formUrl,
    });
  }

  const filled = await page.evaluate(
    ({ sel, fields, values }) => {
      const form = document.querySelector<HTMLFormElement>(sel);
      if (!form) return { ok: false, reason: 'form disappeared', options: [] as string[] };

      const set = (name: string, value: string | undefined): boolean => {
        if (value === undefined) return true;
        const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
        if (!el) return false;
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return el.value === value;
      };

      const locationSelect = form.elements.namedItem(fields.pickupLocation) as HTMLSelectElement | null;
      const available = locationSelect
        ? Array.from(locationSelect.options, (o) => `${o.value}=${o.textContent?.trim()}`)
        : [];

      const okPickup = set(fields.pickupLocation, values.pickupLocation);
      const okDropoff = set(fields.dropoffLocation, values.dropoffLocation);
      set(fields.pickupDate, values.pickupDate);
      set(fields.pickupTime, values.pickupTime);
      set(fields.dropoffDate, values.dropoffDate);
      set(fields.dropoffTime, values.dropoffTime);
      set(fields.minimumAge, values.minimumAge);
      set(fields.liveInCountry, values.liveInCountry);
      set(fields.categoryType, values.categoryType);

      if (!okPickup || !okDropoff) return { ok: false, reason: 'location id not accepted', options: available };

      form.submit();
      return { ok: true, reason: '', options: available };
    },
    {
      sel: formSelector,
      fields: options.fields,
      values: {
        pickupLocation: query.pickup.sourceLocationCode,
        dropoffLocation: query.dropoff.sourceLocationCode,
        pickupDate: pickup.date,
        pickupTime: pickup.time,
        dropoffDate: dropoff.date,
        dropoffTime: dropoff.time,
        minimumAge: options.driverAgeValue,
        liveInCountry: options.liveInCountryValue,
        categoryType: options.categoryTypeValue,
      },
    },
  );

  if (!filled.ok) {
    throw new CollectionError({
      stage: 'search',
      // a rejected location id is a config problem, not a transient one
      retryable: filled.reason !== 'location id not accepted',
      message: `Could not submit the RCM search form: ${filled.reason}`,
      url: options.formUrl,
      context: { requestedLocation: query.pickup.sourceLocationCode, availableLocations: filled.options },
    });
  }

  await page.waitForURL((url) => url.pathname.includes(options.resultsPath), {
    timeout: ctx.source.timeoutMs,
  }).catch(() => {
    throw new CollectionError({
      stage: 'search',
      message: `Search did not land on ${options.resultsPath}`,
      url: page.url(),
    });
  });

  // Results are rendered from window.rcmAvailableCars once the engine answers.
  try {
    await page.waitForFunction(
      () => {
        const w = window as unknown as { rcmAvailableCars?: unknown[]; rcmErr?: string };
        return (Array.isArray(w.rcmAvailableCars) && w.rcmAvailableCars.length > 0) || !!w.rcmErr;
      },
      undefined,
      { timeout: options.waitAfterSubmitMs },
    );
  } catch {
    // fall through: an empty result set is legitimate (sold out), and is
    // distinguished from a broken page by the location echo check below
  }

  const state = await page.evaluate((): RcmPageState => {
    const w = window as unknown as Record<string, unknown>;
    return {
      url: location.href,
      cars: (w.rcmAvailableCars as RcmPageState['cars']) ?? [],
      locations: (w.rcmLocationFees as RcmPageState['locations']) ?? [],
      categoryTypes: (w.rcmCategoryTypeInfo as RcmPageState['categoryTypes']) ?? [],
      seasonalRates: (w.rcmSeasonalRates as RcmPageState['seasonalRates']) ?? [],
      insuranceOptions: (w.rcmInsuranceOptions as RcmPageState['insuranceOptions']) ?? [],
      taxInclusive: Boolean(w.rcmTaxInclusive),
      errorMessage: String(w.rcmErr ?? ''),
    };
  });

  assertSearchMatchesQuery(state, query, options);
  return state;
}

/**
 * RCM echoes the dates and location it actually priced. Checking that echo is
 * the difference between "no cars available" and "we silently priced the wrong
 * week" — the second would quietly poison the dataset, so it is a hard error.
 */
function assertSearchMatchesQuery(state: RcmPageState, query: SearchQuery, options: RcmOptions): void {
  const pickupEcho = state.locations.find((l) => l.loctype === 'pickup');

  if (!pickupEcho) {
    if (state.cars.length === 0) {
      throw new CollectionError({
        stage: 'parse',
        message: state.errorMessage
          ? `RCM returned no results and reported: ${state.errorMessage}`
          : 'RCM results page exposed neither vehicles nor a pickup echo',
        url: state.url,
      });
    }
    return;
  }

  if (String(pickupEcho.locationid) !== String(query.pickup.sourceLocationCode)) {
    throw new CollectionError({
      stage: 'parse',
      retryable: false,
      message: `RCM priced location ${pickupEcho.locationid} ("${pickupEcho.location}") but we asked for ${query.pickup.sourceLocationCode}`,
      url: state.url,
    });
  }

  const expected = splitLocal(query.pickupLocal);
  const echoed = normaliseEchoDate(pickupEcho.locdate);
  if (echoed && echoed !== expected.date) {
    throw new CollectionError({
      stage: 'parse',
      retryable: false,
      message: `RCM priced pickup ${pickupEcho.locdate} (${echoed}) but we asked for ${expected.date}`,
      url: state.url,
      context: { resultsPath: options.resultsPath },
    });
  }
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** '01 Sep 2026' -> '01/09/2026' */
function normaliseEchoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = /^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -](\d{4})$/.exec(value.trim());
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[2]!.toLowerCase());
  if (month < 0) return undefined;
  return `${m[1]!.padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${m[3]}`;
}

function toOffer(car: RcmAvailableCar, state: RcmPageState, query: SearchQuery): VehicleOffer {
  const acriss = parseAcriss(car.sippcode);
  const categoryType = state.categoryTypes.find((t) => t.id === car.vehiclecategorytypeid);
  const seasonal = state.seasonalRates.filter((s) => s.vehiclecategoryid === car.vehiclecategoryid);
  const pickupEcho = state.locations.find((l) => l.loctype === 'pickup');
  const dropoffEcho = state.locations.find((l) => l.loctype === 'dropoff');

  const available = car.available === 1;
  const dailyPrice = car.discounteddailyrate || car.avgrate || undefined;
  const totalPrice = car.totalrateafterdiscount || undefined;
  const bags = (car.numberoflargecases ?? 0) + (car.numberofsmallcases ?? 0);

  return {
    supplierRaw: query.source.name,
    channel: query.source.name,

    vehicleNameRaw: car.categoryfriendlydescription || car.vehiclecategory,
    // RCM has no marketing class label; the ACRISS code is the best structured
    // hint it gives us, and the normalizer treats it as a fallback only
    vehicleClassRaw: acrissClassHint(car.sippcode) ?? categoryType?.vehiclecategorytype,
    acrissCode: car.sippcode || undefined,
    transmission: acriss.transmission,
    // provenance: both facts come from the SIPP code, not from page text
    transmissionRaw: car.sippcode || undefined,
    fuelType: acriss.fuelType,
    fuelTypeRaw: car.sippcode || undefined,
    seats: car.numberofadults || undefined,
    bags: bags || undefined,

    totalPrice: available ? totalPrice : undefined,
    totalPriceRaw: available && totalPrice !== undefined ? `NZ$${totalPrice.toFixed(2)}` : undefined,
    dailyPrice: available ? dailyPrice : undefined,
    dailyPriceRaw: available && dailyPrice !== undefined ? `NZ$${dailyPrice.toFixed(2)}/day` : undefined,
    currency: pickupEcho?.currencyname ?? 'NZD',
    priceIncludesTaxes: state.taxInclusive,
    payType: 'unknown',

    availability: available ? 'available' : 'sold_out',
    availabilityRaw: car.availablemessage,

    sourceUrl: state.url,
    offerFingerprint: shortHash(query.source.code, car.vehiclecategoryid, car.sippcode, query.pickupLocal, query.durationDays),

    raw: {
      car,
      categoryType,
      seasonalRates: seasonal,
      pickupEcho,
      dropoffEcho,
      // the discount fields are how RCM expresses a promotion; keeping them
      // means we can later separate "cheap" from "discounted"
      discount: {
        totalBeforeDiscount: car.totalratebeforediscount,
        totalDiscountAmount: car.totaldiscountamount,
        discountName: car.discountname,
        discountType: car.discounttype,
      },
      fleetSignals: {
        numberVehiclesAvailable: car.numbervehiclesavailable,
        vehiclesBookedPercent: car.vehiclesbookedpercent,
      },
    },
  };
}
