export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { findCheckin, updateCheckin } from '@/lib/online-checkin'
import { NoDocumentSlotError, uploadDocumentToRcm } from '@/lib/rcm-documents'
import { rcmApplyCheckin, rcmPostBooking } from '@/lib/rcm-post'
import { getLocationNames, normalizeBookingInfo } from '@/lib/staff-api'

// The hirer's online check-in (page: /checkin/[token]). The token in the emailed link is the
// only credential, so responses carry just this booking's own details.

const PHOTO_TYPES = {
  licenseFront: 'document-checkin-license-front',
  licenseBack: 'document-checkin-license-back',
  passport: 'document-checkin-passport',
  translation: 'document-checkin-translation',
} as const
type PhotoKey = keyof typeof PHOTO_TYPES

/** Per photo, base64 characters (~6 MB of image). */
const MAX_PHOTO_CHARS = 8_000_000

const notFound = () => NextResponse.json(
  { success: false, error: 'This check-in link has expired or been replaced. Please contact YITU Car Rental.' },
  { status: 404 },
)

const text = (value: unknown, max = 120) => String(value ?? '').trim().slice(0, max)
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const row = await findCheckin(params.token)
  if (!row) return notFound()

  try {
    const results = await rcmPostBooking('bookinginfo', { reservationref: row.booking_ref })
    const booking = normalizeBookingInfo(results, 'pickup', await getLocationNames().catch(() => undefined))
    const raw = results?.customerinfo?.[0] || {}
    if (!row.opened_at) await updateCheckin(row.id, { opened_at: new Date().toISOString(), ...(row.status === 'sent' ? { status: 'opened' } : {}) })

    // Prefer what the hirer already submitted here, else what RCM holds.
    const saved = row.data || {}
    const pick = (key: string, fallback: string) => String(saved[key] ?? fallback ?? '')
    return NextResponse.json({
      success: true,
      submittedAt: row.submitted_at,
      photos: row.photos,
      booking: {
        reservationNo: booking.reservationNo || booking.bookingRef,
        vehicle: booking.vehicleModel,
        pickupDate: booking.pickupDate,
        pickupTime: booking.pickupTime,
        pickupLocation: booking.pickupLocation,
        dropoffDate: booking.dropoffDate,
        dropoffTime: booking.dropoffTime,
        dropoffLocation: booking.dropoffLocation,
      },
      details: {
        firstName: booking.customer.firstName,
        lastName: booking.customer.lastName,
        email: booking.customer.email,
        mobile: pick('mobile', booking.customer.phone),
        dateOfBirth: pick('dateOfBirth', isDate(booking.customer.dateOfBirth) ? booking.customer.dateOfBirth : ''),
        address: pick('address', String(raw.address || '').trim()),
        city: pick('city', String(raw.city || '').trim()),
        postcode: pick('postcode', String(raw.postcode || '').trim()),
        licenseCountry: pick('licenseCountry', ''),
        licenseNo: pick('licenseNo', booking.customer.licenseNo),
        licenseIssued: pick('licenseIssued', booking.customer.licenseIssued),
        licenseExpires: pick('licenseExpires', isDate(booking.customer.licenseExpires) ? booking.customer.licenseExpires : ''),
        passport: pick('passport', booking.customer.passport),
        flightIn: pick('flightIn', booking.flightIn),
      },
    })
  } catch (err: any) {
    console.error('[checkin] load error:', row.booking_ref, err.message)
    return NextResponse.json({ success: false, error: 'Could not load your booking. Please try again shortly.' }, { status: 502 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const row = await findCheckin(params.token)
  if (!row) return notFound()

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 }) }

  const details = {
    mobile: text(body.mobile, 40),
    dateOfBirth: text(body.dateOfBirth, 10),
    address: text(body.address, 200),
    city: text(body.city, 80),
    postcode: text(body.postcode, 20),
    licenseCountry: text(body.licenseCountry, 40),
    licenseNo: text(body.licenseNo, 40).toUpperCase().replace(/\s+/g, ''),
    licenseIssued: text(body.licenseIssued, 60),
    licenseExpires: text(body.licenseExpires, 10),
    passport: text(body.passport, 30).toUpperCase(),
    flightIn: text(body.flightIn, 10).toUpperCase().replace(/[^A-Z0-9]/g, ''),
    agreedName: text(body.agreedName, 120),
  }
  const photos: Partial<Record<PhotoKey, string>> = {}
  for (const key of Object.keys(PHOTO_TYPES) as PhotoKey[]) {
    const value = body.photos?.[key]
    if (typeof value === 'string' && value) photos[key] = value
  }

  const have = new Set([...row.photos, ...Object.keys(photos)])
  const problems: string[] = []
  if (!details.mobile) problems.push('mobile')
  if (!isDate(details.dateOfBirth)) problems.push('dateOfBirth')
  if (!details.licenseNo) problems.push('licenseNo')
  if (!isDate(details.licenseExpires)) problems.push('licenseExpires')
  if (!details.licenseIssued) problems.push('licenseIssued')
  if (details.flightIn && !/^[A-Z0-9]{3,8}$/.test(details.flightIn)) problems.push('flightIn')
  if (!have.has('licenseFront')) problems.push('licenseFront')
  if (!have.has('licenseBack')) problems.push('licenseBack')
  if (details.licenseCountry === 'CN' && !have.has('translation')) problems.push('translation')
  if (body.agreed !== true || !details.agreedName) problems.push('agreed')
  if (Object.values(photos).some(value => value!.length > MAX_PHOTO_CHARS)) problems.push('photoSize')
  if (problems.length) return NextResponse.json({ success: false, error: 'Please complete the highlighted fields.', fields: problems }, { status: 400 })

  // Photos first: if one fails the hirer can simply submit again.
  const uploaded: string[] = []
  try {
    for (const [key, imageBase64] of Object.entries(photos) as [PhotoKey, string][]) {
      await uploadDocumentToRcm({
        reservationRef: row.booking_ref,
        photoType: PHOTO_TYPES[key],
        imageBase64,
        source: 'YITU Online Check-in',
        notes: `Uploaded by the hirer in online check-in (${key})`,
      })
      uploaded.push(key)
    }
  } catch (err: any) {
    console.error('[checkin] photo upload failed:', row.booking_ref, err.message)
    if (uploaded.length) await updateCheckin(row.id, { photos: Array.from(new Set([...row.photos, ...uploaded])) }).catch(() => {})
    const message = err instanceof NoDocumentSlotError
      ? 'We could not attach photos to this booking. Please bring your licence to the counter.'
      : 'A photo could not be uploaded. Please check your connection and submit again.'
    return NextResponse.json({ success: false, error: message }, { status: 502 })
  }

  const now = new Date().toISOString()
  const { agreedName, ...forRcm } = details
  const data = { ...details, agreedAt: now, userAgent: text(req.headers.get('user-agent'), 200) }
  let rcmError = ''
  try {
    await rcmApplyCheckin(row.booking_ref, forRcm)
  } catch (err: any) {
    // The hirer is done; staff see the error in YITU Lite and fix it in RCM.
    rcmError = String(err.message || 'RCM update failed').slice(0, 300)
    console.error('[checkin] RCM update failed:', row.booking_ref, rcmError)
  }

  await updateCheckin(row.id, {
    status: 'submitted',
    submitted_at: now,
    data,
    photos: Array.from(new Set([...row.photos, ...uploaded])),
    rcm_synced_at: rcmError ? null : now,
    rcm_error: rcmError || null,
  })
  console.log('[checkin] submitted', row.booking_ref, 'photos', uploaded.length, rcmError ? 'rcm-error' : 'rcm-ok')
  return NextResponse.json({ success: true, submittedAt: now })
}
