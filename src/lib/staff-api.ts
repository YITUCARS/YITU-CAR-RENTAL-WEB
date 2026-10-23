import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { rcmCall, rcmStep1 } from '@/lib/rcm'
import { verifyPartnerPassword } from '@/lib/partner-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { incrementalSync, isRcmMirrorReady } from '@/lib/rcm-sync'
import { exportDayRange, parseExportDateTime, rcmExport } from '@/lib/rcm-export'
import {
  accountPermissions,
  defaultPermissionsForRole,
  type StaffPermission,
  type StaffRole,
} from '@/lib/staff-permissions'

export type { StaffPermission, StaffRole } from '@/lib/staff-permissions'

// Long-lived so staff stay signed in; requireStaff re-checks the account on every request,
// so disabling or deleting it in /admin takes effect within a minute.
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 365

type StaffUser = {
  id: string
  password: string
  name?: string
}

export type StaffPayload = {
  staffId: string
  name: string
  role?: StaffRole
  permissions?: StaffPermission[]
  /** RCM branch names the account may see; empty/missing = all. */
  branches?: string[]
  exp: number
}

export type StaffIdentity = {
  id: string
  name: string
  role: StaffRole
  permissions: StaffPermission[]
  branches: string[]
}

function tokenSecret() {
  return process.env.STAFF_TOKEN_SECRET || process.env.RCM_SHARED_SECRET || process.env.ADMIN_PASSWORD || 'yitu-staff-dev-secret'
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(payload: string) {
  return crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url')
}

function parseStaffUsers(): StaffUser[] {
  if (process.env.STAFF_USERS) {
    try {
      const parsed = JSON.parse(process.env.STAFF_USERS)
      if (Array.isArray(parsed)) return parsed
    } catch {
      console.warn('Invalid STAFF_USERS JSON; falling back to STAFF_ID/STAFF_PASSWORD')
    }
  }

  return [
    {
      id: process.env.STAFF_ID || 'chancy001',
      password: process.env.STAFF_PASSWORD || '1234',
      name: process.env.STAFF_NAME || 'YITU Staff',
    },
  ]
}

export function issueStaffToken(staff: StaffIdentity) {
  const payload: StaffPayload = {
    staffId: staff.id,
    name: staff.name || staff.id,
    role: staff.role,
    permissions: staff.permissions,
    branches: staff.branches,
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const encoded = base64UrlEncode(JSON.stringify(payload))
  return `${encoded}.${sign(encoded)}`
}

export function verifyStaffToken(token: string | null): StaffPayload | null {
  return decodeStaffToken(token, false)
}

/**
 * Accepts an expired token only for the session-renewal endpoint. The HMAC must still be valid,
 * and the endpoint re-checks the current database account before issuing a replacement.
 */
export function verifyRefreshableStaffToken(token: string | null): StaffPayload | null {
  return decodeStaffToken(token, true)
}

function decodeStaffToken(token: string | null, allowExpired: boolean): StaffPayload | null {
  if (!token) return null
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null
  const expected = sign(encoded)
  const suppliedBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  if (suppliedBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(suppliedBytes, expectedBytes)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as StaffPayload
    if (!payload.staffId || !Number.isFinite(payload.exp) || (!allowExpired && payload.exp < Date.now())) return null
    return payload
  } catch {
    return null
  }
}

/**
 * Accounts managed in /admin (Supabase `staff_accounts`) take precedence. The STAFF_USERS env
 * list is a fallback so existing logins keep working until they're recreated in the admin.
 */
export async function authenticateStaff(staffId: string, password: string): Promise<StaffIdentity | null> {
  const username = staffId.trim().toLowerCase()
  const supabase = getSupabaseAdmin()
  const lookup = await supabase
    .from('staff_accounts')
    .select('id, username, display_name, password_hash, role, permissions, branches, active')
    .eq('username', username)
    .maybeSingle()
  let account: any = lookup.data
  let lookupError = lookup.error
  if (lookupError?.code === '42703') {
    const legacy = await supabase
      .from('staff_accounts')
      .select('id, username, display_name, password_hash, role, branches, active')
      .eq('username', username)
      .maybeSingle()
    account = legacy.data ? { ...legacy.data, permissions: undefined } : null
    lookupError = legacy.error
  }

  if (lookupError) console.warn('[staff-api] staff_accounts lookup failed; using STAFF_USERS only:', lookupError.message)

  if (account) {
    if (!account.active || !verifyPartnerPassword(password, account.password_hash)) return null
    await supabase.from('staff_accounts').update({ last_login_at: new Date().toISOString() }).eq('id', account.id)
    const role: StaffRole = account.role === 'manager' ? 'manager' : 'staff'
    return {
      id: account.username,
      name: account.display_name,
      role,
      permissions: accountPermissions(account.permissions, role),
      branches: Array.isArray(account.branches) ? account.branches : [],
    }
  }

  const user = parseStaffUsers().find((item) => item.id === staffId && item.password === password)
  return user ? { id: user.id, name: user.name || user.id, role: 'manager', permissions: defaultPermissionsForRole('manager'), branches: [] } : null
}

/** Whether a booking's branch is visible to this token. */
export function staffCanSeeBranch(payload: StaffPayload | null, branch: string) {
  const allowed = payload?.branches || []
  return allowed.length === 0 || allowed.includes(branch)
}

const ACCOUNT_CHECK_TTL_MS = 60 * 1000
const accountChecks = new Map<string, { at: number; account: StaffIdentity | null }>()

/** Current state of the account behind a token: admin-managed first, then STAFF_USERS. */
export async function getCurrentStaffIdentity(staffId: string): Promise<StaffIdentity | null> {
  const hit = accountChecks.get(staffId)
  if (hit && Date.now() - hit.at < ACCOUNT_CHECK_TTL_MS) return hit.account

  let account: StaffIdentity | null = null
  const supabase = getSupabaseAdmin()
  const lookup = await supabase
    .from('staff_accounts')
    .select('username, display_name, role, permissions, branches, active')
    .eq('username', staffId.toLowerCase())
    .maybeSingle()
  let data: any = lookup.data
  let lookupError = lookup.error
  if (lookupError?.code === '42703') {
    const legacy = await supabase
      .from('staff_accounts')
      .select('username, display_name, role, branches, active')
      .eq('username', staffId.toLowerCase())
      .maybeSingle()
    data = legacy.data ? { ...legacy.data, permissions: undefined } : null
    lookupError = legacy.error
  }
  if (lookupError) {
    console.warn('[staff-api] account check failed:', lookupError.message)
    // Environment-backed emergency accounts do not depend on this table. Managed database
    // accounts still fail closed, so a database outage cannot silently restore revoked access.
    const envUser = parseStaffUsers().find(user => user.id === staffId)
    return envUser
      ? { id: envUser.id, name: envUser.name || envUser.id, role: 'manager', permissions: defaultPermissionsForRole('manager'), branches: [] }
      : null
  }
  if (data) {
    const role: StaffRole = data.role === 'manager' ? 'manager' : 'staff'
    account = data.active
      ? { id: data.username, name: data.display_name, role, permissions: accountPermissions(data.permissions, role), branches: data.branches || [] }
      : null
  } else {
    const envUser = parseStaffUsers().find(user => user.id === staffId)
    account = envUser ? { id: envUser.id, name: envUser.name || envUser.id, role: 'manager', permissions: defaultPermissionsForRole('manager'), branches: [] } : null
  }
  accountChecks.set(staffId, { at: Date.now(), account })
  return account
}

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
}

function forbidden(permission: StaffPermission) {
  return NextResponse.json({ success: false, error: `Missing permission: ${permission}` }, { status: 403 })
}

export function staffHasPermission(payload: StaffPayload | null, permission: StaffPermission) {
  return payload?.permissions?.includes(permission) === true
}

/**
 * Verifies the staff token and that the account still exists and is active. Role and branches
 * come from the account's current settings, so admin changes apply without signing in again.
 */
export async function requireStaff(req: NextRequest, permission?: StaffPermission) {
  const token = verifyStaffToken(req.headers.get('x-staff-token'))
  if (!token) return { payload: null, response: unauthorized() }

  const account = await getCurrentStaffIdentity(token.staffId)
  if (!account) return { payload: null, response: unauthorized() }

  const payload: StaffPayload = {
    ...token,
    name: account.name,
    role: account.role,
    permissions: account.permissions,
    branches: account.branches,
  }
  if (permission && !staffHasPermission(payload, permission)) {
    return { payload, response: forbidden(permission) }
  }
  return { payload, response: null }
}

export function money(value: any) {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num : 0
}

export function pickString(source: Record<string, any>, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && `${value}`.trim() !== '') return `${value}`
  }
  return fallback
}

export function normalizeBooking(raw: Record<string, any>, fallbackType: 'pickup' | 'dropoff' = 'pickup') {
  const bookingRef = pickString(raw, ['reservationref', 'reservationRef', 'reservationno', 'reservationNo', 'bookingref', 'refno'])
  const firstName = pickString(raw, ['firstname', 'firstName', 'customerfirstname'])
  const lastName = pickString(raw, ['lastname', 'lastName', 'customerlastname'])
  const customerName = pickString(raw, ['customername', 'customerName', 'name'], [firstName, lastName].filter(Boolean).join(' '))
  const pickupDate = pickString(raw, ['pickupdate', 'pickupDate', 'pickup_date'])
  const dropoffDate = pickString(raw, ['dropoffdate', 'dropoffDate', 'returndate', 'returnDate'])
  const pickupTime = pickString(raw, ['pickuptime', 'pickupTime', 'hireouttime'], '10:00')
  const dropoffTime = pickString(raw, ['dropofftime', 'dropoffTime', 'returntime'], '10:00')
  const vehicleModel = pickString(raw, ['vehiclecategory', 'vehicleCategory', 'vehicle', 'vehicledescription', 'carmodel', 'model'], 'Vehicle not assigned')
  const vehiclePlate = pickString(raw, ['registrationno', 'registration', 'rego', 'vehiclereg', 'vehicleplate', 'plate'], 'TBC')
  const total = money(raw.total ?? raw.totalcost ?? raw.grandtotal ?? raw.balance ?? raw.estimatedtotal ?? raw.totalamount)
  const paid = money(raw.paid ?? raw.amountpaid ?? raw.totalpaid ?? raw.paidamount)

  return {
    id: bookingRef || crypto.randomUUID(),
    bookingRef,
    reservationNo: pickString(raw, ['reservationno', 'reservationNo']),
    customerName: customerName || 'Customer',
    vehiclePlate,
    vehicleModel,
    pickupDate,
    dropoffDate,
    pickupTime,
    dropoffTime,
    pickupLocation: pickString(raw, ['pickuplocation', 'pickupLocation', 'locationpickup', 'pickupLocationName'], 'Pick up branch'),
    dropoffLocation: pickString(raw, ['dropofflocation', 'dropoffLocation', 'locationdropoff', 'returnLocationName'], 'Return branch'),
    time: fallbackType === 'pickup' ? pickupTime : dropoffTime,
    type: fallbackType,
    status: pickString(raw, ['status', 'bookingstatus', 'bookingStatus'], 'pending').toLowerCase().replace(/\s+/g, '_'),
    dailyRate: money(raw.dailyrate ?? raw.dailyRate ?? raw.rate),
    rentalTotal: money(raw.rentaltotal ?? raw.rentalTotal ?? raw.subtotal),
    insuranceTotal: money(raw.insurancetotal ?? raw.insuranceTotal),
    gst: money(raw.gst ?? raw.tax ?? raw.taxtotal),
    total,
    paid,
    balanceDue: money(raw.balancedue ?? raw.balanceDue ?? (total > 0 ? total - paid : 0)),
    fuelPolicy: pickString(raw, ['fuelpolicy', 'fuelPolicy'], 'Full to Full'),
    insuranceType: pickString(raw, ['insurancetype', 'insuranceType', 'insurance'], 'Standard Cover'),
    specialRequests: pickString(raw, ['comments', 'notes', 'specialrequests'], 'None'),
    raw,
  }
}

// ── RCM-backed booking lists for YITU Lite / Telegram ─────────────────────────

const BOOKING_LIST_MAX_AGE_MS = 1000 * 60 * 2 // short cache shared by all staff
const BOOKING_INFO_MAX_AGE_MS = 1000 * 60 * 2
const LOCATIONS_MAX_AGE_MS = 1000 * 60 * 60 * 6

const bookingInfoCache = new Map<string, { at: number; value: any }>()
let locationsCache: { at: number; names: Map<number, string> } | null = null

/** Accepts `YYYY-MM-DD` or RCM's `DD/MM/YYYY`. */
function toIsoDate(date: string) {
  const rcm = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return rcm ? `${rcm[3]}-${rcm[2]}-${rcm[1]}` : date
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

/** bookinginfo dates look like `16/Nov/2026`. */
function bookingInfoDate(value: string) {
  const match = String(value || '').match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{4})$/)
  if (!match) return value || ''
  return `${match[3]}-${MONTHS[match[2].toLowerCase()] || '01'}-${match[1].padStart(2, '0')}`
}

export async function getLocationNames() {
  if (locationsCache && Date.now() - locationsCache.at < LOCATIONS_MAX_AGE_MS) return locationsCache.names
  const results = await rcmStep1()
  const names = new Map<number, string>()
  for (const row of results?.locations || []) names.set(Number(row.id), String(row.location || '').trim())
  locationsCache = { at: Date.now(), names }
  return names
}

async function getBookingInfo(reservationRef: string) {
  const hit = bookingInfoCache.get(reservationRef)
  if (hit && Date.now() - hit.at < BOOKING_INFO_MAX_AGE_MS) return hit.value
  const value = await rcmCall('bookinginfo', { reservationref: reservationRef })
  bookingInfoCache.set(reservationRef, { at: Date.now(), value })
  return value
}

/** RCM status → YITU Lite status, relative to the tab (a Hired booking is done for pick-up but pending for drop-off). */
function staffStatus(rcmStatus: string, type: 'pickup' | 'dropoff') {
  const status = rcmStatus.trim().toLowerCase()
  if (status === 'returned') return 'completed'
  if (status === 'hired') return type === 'pickup' ? 'completed' : 'pending'
  return 'pending'
}

/** Maps a `bookinginfo` response into the shape YITU Lite's BookingDTO decodes. */
export function normalizeBookingInfo(results: any, type: 'pickup' | 'dropoff', locationNames?: Map<number, string>) {
  const info = results?.bookinginfo?.[0] || {}
  const customer = results?.customerinfo?.[0] || {}
  const rate = results?.rateinfo?.[0] || {}
  const fees: any[] = results?.extrafees || []

  const pickupLocationId = Number(info.pickuplocationid)
  const dropoffLocationId = Number(info.dropofflocationid)
  const pickupLocation = locationNames?.get(pickupLocationId) || String(info.pickuplocationname || '').trim()
  const dropoffLocation = locationNames?.get(dropoffLocationId) || String(info.dropofflocationname || '').trim()
  const total = money(info.totalcost)
  const insuranceTotal = fees.filter(fee => fee.isinsurancefee).reduce((sum, fee) => sum + money(fee.totalfeeamount), 0)

  return {
    id: String(info.reservationref || info.reservationno || ''),
    bookingRef: String(info.reservationref || ''),
    reservationNo: info.reservationno ? String(info.reservationno) : '',
    customerName: [customer.firstname, customer.lastname].filter(Boolean).join(' ').trim() || 'Customer',
    vehiclePlate: String(info.vehicle_registrationnumber || '').trim() || 'TBC',
    vehicleModel: String(info.vehiclecategory || '').trim() || 'Vehicle not assigned',
    pickupDate: bookingInfoDate(info.pickupdate),
    dropoffDate: bookingInfoDate(info.dropoffdate),
    pickupTime: info.pickuptime || '',
    dropoffTime: info.dropofftime || '',
    pickupLocation: pickupLocation || 'Pick up branch',
    dropoffLocation: dropoffLocation || 'Return branch',
    // Branch the booking belongs to on this tab — used by the app's branch filter.
    branch: type === 'pickup' ? pickupLocation : dropoffLocation,
    time: (type === 'pickup' ? info.pickuptime : info.dropofftime) || '',
    type,
    status: staffStatus(String(info.reservationstatus || ''), type),
    rcmStatus: String(info.reservationstatus || '').trim(),
    dailyRate: money(info.dailyrate),
    rentalTotal: money(rate.ratesubtotal),
    insuranceTotal,
    gst: money(info.gst),
    total,
    paid: money(info.payment),
    balanceDue: money(info.balancedue),
    fuelPolicy: 'Full to Full',
    insuranceType: fees.find(fee => fee.isinsurancefee)?.name || 'Standard Cover',
    specialRequests: String(info.customerremark || '').trim() || 'None',
    // Flights the customer entered when booking (arrival for pick-up, departure for return).
    flightIn: String(info.flightin || '').trim(),
    flightOut: String(info.flightout || '').trim(),
    agreementPage: info.agreementpage || '',
    // Odometer recorded in RCM at hire-out, if staff already entered it there.
    kmsOut: String(info.kmsout ?? '').trim(),
    customer: {
      firstName: String(customer.firstname || '').trim(),
      lastName: String(customer.lastname || '').trim(),
      dateOfBirth: bookingInfoDate(customer.dateofbirth || ''),
      email: String(customer.email || '').trim(),
      phone: String(customer.mobile || customer.phone || '').trim(),
      licenseNo: String(customer.licenseno || '').trim(),
      licenseExpires: bookingInfoDate(customer.licenseexpires || ''),
      licenseIssued: String(customer.licenseissued || '').trim(),
      passport: String(customer.passport || '').trim(),
      country: String(customer.country || '').trim(),
    },
    // Additional drivers already on the booking in RCM.
    extraDrivers: (results?.extradrivers || []).map((driver: any) => ({
      customerId: Number(driver.customerid),
      firstName: String(driver.firstname || '').trim(),
      lastName: String(driver.lastname || '').trim(),
      dateOfBirth: bookingInfoDate(driver.dateofbirth || ''),
      email: String(driver.email || '').trim(),
      phone: String(driver.mobile || driver.phone || '').trim(),
      licenseNo: String(driver.licenseno || '').trim(),
      licenseExpires: bookingInfoDate(driver.licenseexpires || ''),
      licenseIssued: String(driver.licenseissued || '').trim(),
    })),
  }
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

/** RCM booking types that are real hires (quotes and cancellations are left out). */
export const ACTIVE_BOOKING_STATUSES = ['Reservation', 'Unallocated Reservation', 'Hired', 'Returned']
const LISTED_STATUSES = new Set(ACTIVE_BOOKING_STATUSES.map(status => status.toLowerCase()))

type StaffBookingsParams = {
  date: string
  type: 'pickup' | 'dropoff'
  status?: string
  force?: boolean
}

/**
 * Bookings picking up / dropping off on `date`.
 * Read from the synced mirror (`rcm_bookings`, see rcm-sync.ts) once a full sync has run;
 * pull-to-refresh (`force`) runs an incremental sync first. Before the mirror exists this
 * falls back to calling RCM live.
 */
export async function getStaffBookings(params: StaffBookingsParams) {
  if (await isRcmMirrorReady()) {
    try {
      return await getStaffBookingsFromMirror(params)
    } catch (err: any) {
      console.warn('[staff-api] mirror read failed; calling RCM live:', err.message)
    }
  }
  return getStaffBookingsLive(params)
}

async function getStaffBookingsFromMirror(params: StaffBookingsParams) {
  if (params.force) {
    await incrementalSync().catch((err: any) => console.warn('[staff-api] refresh sync failed:', err.message))
  }
  const isoDate = toIsoDate(params.date)
  const dateColumn = params.type === 'pickup' ? 'pickup_date' : 'dropoff_date'
  const { data, error } = await getSupabaseAdmin()
    .from('rcm_bookings')
    .select('*')
    .eq(dateColumn, isoDate)
    .in('status', ACTIVE_BOOKING_STATUSES)
  if (error) throw error

  const bookings = (data || []).map((row: any) => mirrorRowToBooking(row, params.type))
  bookings.sort((a: any, b: any) => String(a.time).localeCompare(String(b.time)))
  const { data: state } = await getSupabaseAdmin().from('rcm_sync_state').select('value').eq('key', 'incremental').maybeSingle()
  return Object.assign(bookings, { fetchedAt: state?.value ? Date.parse(state.value) : Date.now(), stale: false })
}

/** A mirror row as the YITU Lite booking shape, relative to the pick-up or drop-off tab. */
export function mirrorRowToBooking(row: any, type: 'pickup' | 'dropoff') {
  const details = row.details || {}
  const pickupLocation = row.pickup_branch || details.pickupLocation || 'Pick up branch'
  const dropoffLocation = row.dropoff_branch || details.dropoffLocation || 'Return branch'
  return {
    ...details,
    id: row.reservation_ref,
    bookingRef: row.reservation_ref,
    reservationNo: row.reservation_no || details.reservationNo || '',
    customerName: row.customer_name || details.customerName || 'Customer',
    vehiclePlate: row.plate || details.vehiclePlate || 'TBC',
    vehicleModel: row.vehicle || details.vehicleModel || 'Vehicle not assigned',
    pickupDate: row.pickup_date || details.pickupDate || '',
    dropoffDate: row.dropoff_date || details.dropoffDate || '',
    pickupTime: row.pickup_time || details.pickupTime || '',
    dropoffTime: row.dropoff_time || details.dropoffTime || '',
    pickupLocation,
    dropoffLocation,
    branch: type === 'pickup' ? pickupLocation : dropoffLocation,
    time: (type === 'pickup' ? row.pickup_time : row.dropoff_time) || '',
    type,
    status: staffStatus(String(row.status || ''), type),
    rcmStatus: row.status,
  }
}

async function getStaffBookingsLive(params: StaffBookingsParams) {
  const isoDate = toIsoDate(params.date)
  const exported = await rcmExport(
    'repbookingexport',
    { lid: 0, ...exportDayRange(isoDate), td: params.type },
    { maxAgeMs: BOOKING_LIST_MAX_AGE_MS, force: params.force },
  )

  const rows = exported.rows.filter((row: any) =>
    LISTED_STATUSES.has(String(row.bookingtype || '').trim().toLowerCase()) && row.reservationref,
  )
  const locationNames = await getLocationNames().catch(() => undefined)

  const bookings = await mapLimit(rows, 4, async (row: any) => {
    try {
      return {
        ...normalizeBookingInfo(await getBookingInfo(String(row.reservationref)), params.type, locationNames),
        unallocatedReservationNo: String(row.unallocatedreservationno || ''),
      }
    } catch (err: any) {
      // Fall back to the export row so one bad bookinginfo call doesn't hide the booking.
      console.warn('[staff-api] bookinginfo failed for', row.reservationref, err.message)
      const when = parseExportDateTime(params.type === 'pickup' ? row.pickupdatetime : row.dropoffdatetime)
      const locationId = Number(params.type === 'pickup' ? row.pickuplocationid : row.dropofflocationid)
      return {
        id: String(row.reservationref),
        bookingRef: String(row.reservationref),
        reservationNo: String(row.reservationno || ''),
        customerName: [row.customerfirstname, row.customerlastname].filter(Boolean).join(' ').trim() || 'Customer',
        vehiclePlate: 'TBC',
        vehicleModel: String(row.vehiclecategory || '').trim() || 'Vehicle not assigned',
        pickupDate: parseExportDateTime(row.pickupdatetime).date,
        dropoffDate: parseExportDateTime(row.dropoffdatetime).date,
        branch: locationNames?.get(locationId) || '',
        time: when.time,
        type: params.type,
        status: staffStatus(String(row.bookingtype || ''), params.type),
        total: money(row.bookingtotal),
      }
    }
  })

  bookings.sort((a: any, b: any) => String(a.time).localeCompare(String(b.time)))
  return Object.assign(bookings, { fetchedAt: exported.fetchedAt, stale: exported.stale })
}

export async function getStaffBookingDetail(reservationRef: string, type: 'pickup' | 'dropoff' = 'pickup') {
  const locationNames = await getLocationNames().catch(() => undefined)
  return normalizeBookingInfo(await getBookingInfo(reservationRef), type, locationNames)
}
