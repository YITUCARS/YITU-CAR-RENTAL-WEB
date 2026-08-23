import type { Page } from 'playwright';
import type { SearchQuery, VehicleOffer } from '../../models/index.js';
import type { CollectorContext, RentalPriceCollector } from '../types.js';
import { BrowserSession } from '../browser.js';
import { CollectionError } from '../../utils/errors.js';
import { shortHash } from '../../utils/hash.js';
import { parseIntSafe, parseMoney } from '../../utils/text.js';

const VERSION = '1.0.0';

/**
 * A Rentals (arentalscar.com).
 *
 * A WordPress site with its own booking wizard rather than a hosted engine, so
 * this adapter is site-specific — unlike the RCM one, it does not generalise to
 * other operators.
 *
 * Two things about how it quotes:
 *   - prices are the TOTAL for the rental, not a daily rate
 *   - every vehicle carries two prices, a prepaid one ("Pay Now, 5% off") and
 *     the standard one ("Pay Later"). We store the standard price, because that
 *     is what compares to other suppliers' headline rate, and keep the prepaid
 *     figure in `raw` so a prepay-discount analysis is still possible later.
 *
 * robots.txt (checked 2026-08-23) disallows only /wp-admin/; the results page
 * is a plain query string on the homepage and is not restricted.
 */

interface ArentalsOptions {
  formSelector: string;
  resultsMarker: string;
  vehicleSelector: string;
  waitAfterSubmitMs: number;
  driverAgeBands: number[];
}

function readOptions(ctx: CollectorContext): ArentalsOptions {
  const raw = ctx.source.options as Record<string, unknown>;
  return {
    formSelector: String(raw.form_selector ?? 'form[data-js-booking-form]'),
    resultsMarker: String(raw.results_marker ?? 'step=search-results'),
    vehicleSelector: String(raw.vehicle_selector ?? '.vehicle'),
    waitAfterSubmitMs: Number(raw.wait_after_submit_ms ?? 20_000),
    // the site offers age bands, not exact ages
    driverAgeBands: (raw.driver_age_bands as number[]) ?? [21, 25, 60],
  };
}

/** Our exact driver age -> the band this site actually accepts. */
function ageBandFor(age: number, bands: number[]): string {
  const sorted = [...bands].sort((a, b) => a - b);
  let chosen = sorted[0]!;
  for (const band of sorted) if (age >= band) chosen = band;
  return String(chosen);
}

/** '2026-09-20 10:00:00' -> { date: '20/09/2026', time: '1000' } */
function splitLocal(local: string): { date: string; time: string } {
  const [datePart = '', timePart = '00:00:00'] = local.split(' ');
  const [y, m, d] = datePart.split('-');
  return { date: `${d}/${m}/${y}`, time: timePart.slice(0, 5).replace(':', '') };
}

interface RawVehicle {
  vehId: string | null;
  name: string;
  category: string;
  seatsText: string | null;
  bagsText: string | null;
  fuelText: string | null;
  driveText: string | null;
  standardPrice: string | null;
  prepaidPrice: string | null;
  labels: string[];
}

export function createArentalsCollector(ctx: CollectorContext): RentalPriceCollector {
  const options = readOptions(ctx);
  const session = new BrowserSession(ctx.log, { timeoutMs: ctx.source.timeoutMs });

  const collector: RentalPriceCollector & {
    captureFailureState: () => Promise<{ screenshot?: Buffer; html?: string }>;
  } = {
    id: 'arentals',
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
          message: 'DRY_RUN is set; the A Rentals collector will not touch the network',
        });
      }
      const vehicles = await session.withPage((page) => runSearch(page, query, options, ctx));
      return vehicles.map((v) => toOffer(v, query));
    },
  };

  return collector;
}

async function runSearch(
  page: Page,
  query: SearchQuery,
  options: ArentalsOptions,
  ctx: CollectorContext,
): Promise<RawVehicle[]> {
  const pickup = splitLocal(query.pickupLocal);
  const dropoff = splitLocal(query.returnLocal);
  const url = ctx.source.searchUrl ?? ctx.source.baseUrl;

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(options.formSelector, { timeout: ctx.source.timeoutMs }).catch(() => {
    throw new CollectionError({ stage: 'navigate', message: 'booking form never appeared', url });
  });

  const filled = await page.evaluate(
    ({ sel, values }) => {
      const form = document.querySelector<HTMLFormElement>(sel);
      if (!form) return { ok: false, reason: 'form disappeared', locations: [] as string[] };

      const setNative = (name: string, value: string): boolean => {
        const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
        if (!el) return false;
        const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return el.value === value;
      };

      // The date fields are pickadate widgets with their own state; writing the
      // input value alone leaves the picker out of sync and the form refuses to
      // submit, so drive the widget through its own API where it exists.
      const setDate = (id: string, ddmmyyyy: string): boolean => {
        const [d, m, y] = ddmmyyyy.split('/').map(Number);
        const jq = (window as unknown as { jQuery?: (s: string) => { pickadate?: (a: string) => unknown } }).jQuery;
        const picker = jq?.(`#${id}`)?.pickadate?.('picker') as
          | { set: (k: string, v: Date) => void; close: () => void }
          | undefined;
        if (picker && typeof picker.set === 'function') {
          picker.set('select', new Date(y!, m! - 1, d!));
          picker.close();
        }
        const el = document.getElementById(id) as HTMLInputElement | null;
        return el?.value === ddmmyyyy;
      };

      const depot = form.elements.namedItem('pickup-depot') as HTMLSelectElement | null;
      const locations = depot ? Array.from(depot.options, (o) => `${o.value}=${o.textContent?.trim()}`) : [];

      const okPickup = setNative('pickup-depot', values.pickupDepot);
      const okReturn = setNative('return-depot', values.returnDepot);
      setNative('pickup-time', values.pickupTime);
      setNative('return-time', values.returnTime);
      setNative('driver-age', values.driverAge);
      const okDate = setDate('pickup-date', values.pickupDate) && setDate('return-date', values.returnDate);

      if (!okPickup || !okReturn) return { ok: false, reason: 'depot id not accepted', locations };
      if (!okDate) return { ok: false, reason: 'date widget did not accept the dates', locations };

      (document.activeElement as HTMLElement | null)?.blur();
      const submit = form.querySelector<HTMLElement>('button[type=submit], input[type=submit]');
      if (!submit) return { ok: false, reason: 'no submit button', locations };
      submit.click();
      return { ok: true, reason: '', locations };
    },
    {
      sel: options.formSelector,
      values: {
        pickupDepot: query.pickup.sourceLocationCode,
        returnDepot: query.dropoff.sourceLocationCode,
        pickupDate: pickup.date,
        pickupTime: pickup.time,
        returnDate: dropoff.date,
        returnTime: dropoff.time,
        driverAge: ageBandFor(query.driverAge, options.driverAgeBands),
      },
    },
  );

  if (!filled.ok) {
    throw new CollectionError({
      stage: 'search',
      retryable: filled.reason !== 'depot id not accepted',
      message: `Could not submit the A Rentals search: ${filled.reason}`,
      url,
      context: { requestedDepot: query.pickup.sourceLocationCode, availableDepots: filled.locations },
    });
  }

  await page
    .waitForFunction(
      ([marker, vehSel]) =>
        location.search.includes(marker as string) &&
        document.querySelectorAll(vehSel as string).length > 0,
      [options.resultsMarker, options.vehicleSelector],
      { timeout: options.waitAfterSubmitMs },
    )
    .catch(() => {
      throw new CollectionError({
        stage: 'search',
        message: 'search never produced a results page with vehicles',
        url: page.url(),
      });
    });

  return page.evaluate((vehSel) => {
    // classes the theme uses for grid layout rather than for the category
    const LAYOUT = new Set(['mix', 'columns', 'row', 'small-12', 'medium-12', 'large-12']);
    return Array.from(document.querySelectorAll(vehSel), (card: Element) => {
      const wrap = card.closest('.mix');
      const category = String(wrap?.className ?? '')
        .split(/\s+/)
        .filter((c) => c && !LAYOUT.has(c))
        .join(' ');

      const spec: Record<string, string> = {};
      card.querySelectorAll('.vehicle__list-item').forEach((item: Element) => {
        const icon = item.querySelector('[class^=icon-]')?.className ?? '';
        spec[icon] = (item.querySelector('.vehicle__list-title') ?? item).textContent?.trim() ?? '';
      });

      let standardPrice: string | null = null;
      let prepaidPrice: string | null = null;
      const labels: string[] = [];
      card.querySelectorAll('.vehicle__total').forEach((el: Element) => {
        const context = el.parentElement?.textContent ?? '';
        labels.push(context.replace(/\s+/g, ' ').trim());
        if (/pay now/i.test(context)) prepaidPrice = el.textContent?.trim() ?? null;
        else standardPrice = el.textContent?.trim() ?? null;
      });

      return {
        vehId: (card as HTMLElement).dataset.vehid ?? null,
        name: card.querySelector('strong')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        category,
        seatsText: spec['icon-seats'] ?? null,
        bagsText: spec['icon-bag-large'] ?? null,
        fuelText: spec['icon-fuel'] ?? null,
        driveText: spec['icon-fwd'] ?? spec['icon-awd'] ?? spec['icon-4wd'] ?? null,
        standardPrice,
        prepaidPrice,
        labels,
      };
    });
  }, options.vehicleSelector);
}

function toOffer(v: RawVehicle, query: SearchQuery): VehicleOffer {
  const total = parseMoney(v.standardPrice);
  const prepaid = parseMoney(v.prepaidPrice);
  // A vehicle with no price is shown but not bookable for these dates.
  const available = total !== undefined;

  return {
    supplierRaw: query.source.name,
    channel: query.source.name,

    vehicleNameRaw: v.name,
    vehicleClassRaw: v.category || undefined,
    transmissionRaw: undefined,
    fuelTypeRaw: v.fuelText ?? undefined,
    seats: parseIntSafe(v.seatsText),
    bags: parseIntSafe(v.bagsText),

    // the site quotes a rental total; the normalizer derives the daily rate
    totalPrice: available ? total : undefined,
    totalPriceRaw: v.standardPrice ?? undefined,
    currency: 'NZD',
    priceIncludesTaxes: true,
    // "Pay Later" here means a 1% deposit now and the balance later, which is
    // the closest thing this site has to a counter-paid rate
    payType: available ? 'pay_at_counter' : undefined,

    availability: available ? 'available' : 'sold_out',
    availabilityRaw: available ? v.labels[0] : 'no price shown',

    sourceUrl: `${query.source.baseUrl}?step=search-results`,
    offerFingerprint: shortHash(query.source.code, v.vehId, v.name, query.pickupLocal, query.durationDays),

    raw: {
      vehicle: v,
      pricing: {
        standardTotalRaw: v.standardPrice,
        prepaidTotalRaw: v.prepaidPrice,
        prepaidTotal: prepaid,
        prepaidDiscount: total !== undefined && prepaid !== undefined ? Math.round((1 - prepaid / total) * 1000) / 10 : undefined,
      },
      drive: v.driveText,
    },
  };
}
