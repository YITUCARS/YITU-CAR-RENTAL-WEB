import { rcmCall } from '@/lib/rcm'
import { exportDayRange, parseExportDateTime, rcmExport } from '@/lib/rcm-export'
import { msToNzLocal } from '@/lib/nz-time'
import { getLocationNames, normalizeBookingInfo } from '@/lib/staff-api'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { notifyNewBookings } from '@/lib/staff-notify'

const ACTIVE_STATUSES = new Set(['reservation', 'unallocated reservation', 'hired', 'returned'])

// Mirrors RCM bookings into Supabase `rcm_bookings` (see supabase/rcm-bookings.sql), so staff
// lists and the calendar don't call RCM on every request.
//
//   full        — every booking picking up or dropping off in a date window (nightly safety net)
//   incremental — bookings RCM reports as created/changed since the last run (every 5 minutes)
//
// Changed bookings are enriched with `bookinginfo` (plate, customer, totals) and stored as the
// same normalised shape YITU Lite already uses.

const STATE_INCREMENTAL = 'incremental'
const STATE_FULL = 'full'
/** Re-read a little before the last run so bookings saved during it aren't missed. */
const OVERLAP_MS = 10 * 60 * 1000

function db() {
  return getSupabaseAdmin()
}

async function readState(key: string) {
  const { data, error } = await db().from('rcm_sync_state').select('value').eq('key', key).maybeSingle()
  if (error) throw error
  return data?.value as string | undefined
}

async function writeState(key: string, value: string) {
  const { error } = await db().from('rcm_sync_state').upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw error
}

/** Has a full sync ever completed? Until then staff lists fall back to calling RCM live. */
export async function isRcmMirrorReady() {
  try {
    return Boolean(await readState(STATE_FULL))
  } catch {
    return false
  }
}

/** `2026-10-21` + `13:05` → `20261021-1305` (export API format, NZ local). */
function exportStamp(ms: number) {
  const { date, time } = msToNzLocal(ms)
  return `${date.replace(/-/g, '')}-${time.replace(':', '')}`
}

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      out[index] = await fn(items[index])
    }
  }))
  return out
}

/**
 * Enrich export rows with bookinginfo and upsert them.
 * Returns how many were stored and the records that weren't in the mirror before.
 */
async function storeRows(rows: any[]): Promise<{ stored: number; added: any[] }> {
  const byRef = new Map<string, any>()
  for (const row of rows) if (row?.reservationref) byRef.set(String(row.reservationref), row)
  if (byRef.size === 0) return { stored: 0, added: [] }

  const known = new Set<string>()
  const { data: existing, error: existingError } = await db()
    .from('rcm_bookings').select('reservation_ref').in('reservation_ref', Array.from(byRef.keys()))
  if (existingError) throw existingError
  for (const row of existing || []) known.add(row.reservation_ref)

  const names = await getLocationNames().catch(() => new Map<number, string>())
  const records = await mapLimit(Array.from(byRef.values()), 4, async (row: any) => {
    const ref = String(row.reservationref)
    const pickup = parseExportDateTime(row.pickupdatetime)
    const dropoff = parseExportDateTime(row.dropoffdatetime)
    const pickupLocationId = Number(row.pickuplocationid) || null
    const dropoffLocationId = Number(row.dropofflocationid) || null

    let details: any = null
    try {
      details = {
        ...normalizeBookingInfo(await rcmCall('bookinginfo', { reservationref: ref }), 'pickup', names),
        // Unallocated bookings are known by this shorter number until a vehicle is assigned.
        unallocatedReservationNo: String(row.unallocatedreservationno || ''),
      }
    } catch (err: any) {
      console.warn('[rcm-sync] bookinginfo failed for', ref, err.message)
    }

    return {
      reservation_ref: ref,
      reservation_no: String(row.reservationno || details?.reservationNo || ''),
      status: String(row.bookingtype || '').trim(),
      pickup_date: pickup.date || null,
      pickup_time: pickup.time || details?.pickupTime || '',
      dropoff_date: dropoff.date || null,
      dropoff_time: dropoff.time || details?.dropoffTime || '',
      pickup_location_id: pickupLocationId,
      dropoff_location_id: dropoffLocationId,
      pickup_branch: (pickupLocationId && names.get(pickupLocationId)) || details?.pickupLocation || '',
      dropoff_branch: (dropoffLocationId && names.get(dropoffLocationId)) || details?.dropoffLocation || '',
      customer_name: details?.customerName
        || [row.customerfirstname, row.customerlastname].filter(Boolean).join(' ').trim(),
      vehicle: details?.vehicleModel || String(row.vehiclecategory || '').trim(),
      plate: details && details.vehiclePlate !== 'TBC' ? details.vehiclePlate : '',
      total: Number(row.bookingtotal || details?.total || 0),
      agency: String(row.bookingagency || '').trim(),
      rcm_updated: String(row.lastdateupdated || ''),
      details,
      synced_at: new Date().toISOString(),
    }
  })

  for (let i = 0; i < records.length; i += 200) {
    const { error } = await db().from('rcm_bookings').upsert(records.slice(i, i + 200))
    if (error) throw error
  }
  return { stored: records.length, added: records.filter(record => !known.has(record.reservation_ref)) }
}

/** Pause between export calls in a full sync; RCM rate-limits bursts per minute. */
const FULL_SYNC_PACE_MS = 1500

/** Every booking picking up or dropping off between `from` and `to` (inclusive, YYYY-MM-DD). */
export async function fullSync(from: string, to: string) {
  let rows: any[] = []
  let stored = 0
  let daysInBatch = 0
  for (let day = from; day <= to; day = addDays(day, 1)) {
    for (const td of ['pickup', 'dropoff']) {
      const result = await rcmExport('repbookingexport', { lid: 0, ...exportDayRange(day), td }, { maxAgeMs: 0, force: true })
      if (result.stale) throw new Error(`RCM export failed for ${td} ${day}.`)
      rows.push(...result.rows)
      await new Promise(resolve => setTimeout(resolve, FULL_SYNC_PACE_MS))
    }
    // Save every two weeks of data so a failure late in the run keeps what was fetched.
    if (++daysInBatch >= 14) {
      stored += (await storeRows(rows)).stored
      rows = []
      daysInBatch = 0
    }
  }
  stored += (await storeRows(rows)).stored
  await writeState(STATE_FULL, new Date().toISOString())
  return { mode: 'full', from, to, stored }
}

let incrementalRun: Promise<any> | null = null

/**
 * Bookings created or changed since the last incremental run (export `td=updated`).
 * Concurrent callers (cron, webhook, payment) share one run.
 */
export function incrementalSync() {
  if (!incrementalRun) {
    incrementalRun = runIncrementalSync().finally(() => { incrementalRun = null })
  }
  return incrementalRun
}

/**
 * Sync a few times over the next minute — used right after a website payment, when RCM turns
 * the online quote into a booking, so staff get the new-booking push within seconds. RCM may take
 * a moment to show the change; repeats are harmless because each booking notifies once.
 */
export function syncSoon() {
  for (const delay of [3_000, 20_000, 60_000]) {
    setTimeout(() => {
      incrementalSync().catch((err: any) => console.warn('[rcm-sync] post-payment sync failed:', err.message))
    }, delay)
  }
}

async function runIncrementalSync() {
  const now = Date.now()
  const last = await readState(STATE_INCREMENTAL)
  let start = (last ? Date.parse(last) : now - 24 * 60 * 60 * 1000) - OVERLAP_MS

  // The export accepts at most a 1-day range, so long gaps are fetched in chunks.
  const rows: any[] = []
  while (start < now) {
    const end = Math.min(start + 23 * 60 * 60 * 1000, now)
    const result = await rcmExport('repbookingexport', {
      lid: 0, sd: exportStamp(start), ed: exportStamp(end), td: 'updated',
    }, { maxAgeMs: 0, force: true })
    if (result.stale) throw new Error('RCM export failed during incremental sync.')
    rows.push(...result.rows)
    start = end
  }

  const { stored, added } = await storeRows(rows)
  await writeState(STATE_INCREMENTAL, new Date(now).toISOString())

  // Alert staff about bookings that are new to the mirror. Skipped until a full sync has
  // filled it, otherwise every existing booking would look new.
  let notified = 0
  if (await isRcmMirrorReady()) {
    const fresh = added.filter(record => ACTIVE_STATUSES.has(String(record.status).toLowerCase()))
    try {
      notified = (await notifyNewBookings(fresh)).notified
    } catch (err: any) {
      console.error('[rcm-sync] new booking notification failed:', err.message)
    }
  }
  return { mode: 'incremental', since: last || null, changed: stored, newBookings: notified }
}
