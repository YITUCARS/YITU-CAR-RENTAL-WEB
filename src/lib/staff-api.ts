import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { rcmCall, rcmCallWithApiKey } from '@/lib/rcm'

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12

type StaffUser = {
  id: string
  password: string
  name?: string
}

export type StaffPayload = {
  staffId: string
  name: string
  exp: number
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

export function issueStaffToken(staffId: string, name?: string) {
  const payload: StaffPayload = {
    staffId,
    name: name || staffId,
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const encoded = base64UrlEncode(JSON.stringify(payload))
  return `${encoded}.${sign(encoded)}`
}

export function verifyStaffToken(token: string | null): StaffPayload | null {
  if (!token) return null
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature || signature !== sign(encoded)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as StaffPayload
    if (!payload.staffId || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function findStaffUser(staffId: string, password: string) {
  return parseStaffUsers().find((user) => user.id === staffId && user.password === password)
}

export function requireStaff(req: NextRequest) {
  const payload = verifyStaffToken(req.headers.get('x-staff-token'))
  if (!payload) {
    return {
      payload: null,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    }
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

function firstRecord(results: any) {
  if (Array.isArray(results)) return results[0] || {}
  if (Array.isArray(results?.bookinginfo)) return results.bookinginfo[0] || {}
  if (Array.isArray(results?.bookings)) return results.bookings[0] || {}
  return results || {}
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

export async function getStaffBookings(params: {
  date: string
  type: 'pickup' | 'dropoff'
  status?: string
}) {
  const agentApiKey = process.env.RCM_AGENT_API_KEY
  if (!agentApiKey) {
    throw new Error('RCM_AGENT_API_KEY is required for staff pickup/dropoff booking lists. The current RCM_API_KEY cannot call agentbookings.')
  }

  const raw = await rcmCallWithApiKey(agentApiKey, 'agentbookings', {
    startdate: params.date,
    enddate: params.date,
    reservationno: 0,
  })

  const rows = Array.isArray(raw) ? raw : raw?.bookings || raw?.agentbookings || raw?.results || []
  return rows
    .map((row: Record<string, any>) => normalizeBooking(row, params.type))
    .filter((booking: any) => {
      if (params.type === 'pickup') return booking.pickupDate === params.date || booking.raw?.pickupdate === params.date
      return booking.dropoffDate === params.date || booking.raw?.dropoffdate === params.date || booking.raw?.returndate === params.date
    })
}

export async function getStaffBookingDetail(reservationRef: string) {
  const raw = await rcmCall('bookinginfo', { reservationref: reservationRef, refno: reservationRef })
  return normalizeBooking(firstRecord(raw), 'pickup')
}
