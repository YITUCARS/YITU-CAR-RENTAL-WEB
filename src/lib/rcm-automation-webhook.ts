import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { escapeTelegramHtml, sendTelegramMessage } from '@/lib/telegram'

type RcmAutomationEvent = 'created' | 'cancelled'

type NormalizedAutomationBooking = {
  bookingRef: string
  reservationNo: string
  customerName: string
  email: string
  phone: string
  pickup: string
  pickupLocation: string
  dropoff: string
  dropoffLocation: string
  vehicle: string
  total: string
  source: string
  status: string
  cancellationReason: string
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isScalar(value: unknown) {
  return ['string', 'number', 'boolean'].includes(typeof value)
}

function scalarText(value: unknown) {
  const text = String(value ?? '').trim()
  return text && text !== 'null' && text !== 'undefined' ? text : ''
}

function pickDeep(source: unknown, keys: string[], maxDepth = 5): string {
  const wanted = new Set(keys.map(normalizeKey))
  const seen = new Set<unknown>()

  function walk(value: unknown, depth: number): string {
    if (!value || depth > maxDepth || seen.has(value)) return ''
    if (typeof value !== 'object') return ''
    seen.add(value)

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, depth + 1)
        if (found) return found
      }
      return ''
    }

    const record = value as Record<string, unknown>
    for (const [key, fieldValue] of Object.entries(record)) {
      if (wanted.has(normalizeKey(key)) && isScalar(fieldValue)) {
        const text = scalarText(fieldValue)
        if (text) return text
      }
    }

    for (const fieldValue of Object.values(record)) {
      const found = walk(fieldValue, depth + 1)
      if (found) return found
    }

    return ''
  }

  return walk(source, 0)
}

function pickName(payload: unknown) {
  const fullName = pickDeep(payload, [
    'customername',
    'customer_name',
    'clientname',
    'hirername',
    'name',
  ])
  if (fullName) return fullName

  const first = pickDeep(payload, ['firstname', 'first_name', 'customerfirstname', 'customer_first_name'])
  const last = pickDeep(payload, ['lastname', 'last_name', 'surname', 'customerlastname', 'customer_last_name'])
  return [first, last].filter(Boolean).join(' ')
}

function joinDateTime(date: string, time: string) {
  return [date, time].filter(Boolean).join(' ')
}

function normalizeBooking(payload: unknown): NormalizedAutomationBooking {
  const pickupDate = pickDeep(payload, ['pickupdate', 'pickup_date', 'pickupDate', 'dateout', 'startdate'])
  const pickupTime = pickDeep(payload, ['pickuptime', 'pickup_time', 'pickupTime', 'timeout', 'starttime'])
  const dropoffDate = pickDeep(payload, ['dropoffdate', 'dropoff_date', 'dropoffDate', 'returndate', 'enddate'])
  const dropoffTime = pickDeep(payload, ['dropofftime', 'dropoff_time', 'dropoffTime', 'returntime', 'endtime'])

  return {
    bookingRef: pickDeep(payload, [
      'reservationref',
      'reservation_ref',
      'bookingref',
      'booking_ref',
      'refno',
      'reference',
      'bookingreference',
    ]),
    reservationNo: pickDeep(payload, [
      'reservationno',
      'reservation_no',
      'reservationnumber',
      'reservation_number',
      'bookingno',
      'booking_no',
      'bookingnumber',
      'id',
    ]),
    customerName: pickName(payload),
    email: pickDeep(payload, ['email', 'emailaddress', 'customeremail']),
    phone: pickDeep(payload, ['phone', 'phone1', 'mobile', 'cellphone', 'customerphone']),
    pickup: joinDateTime(pickupDate, pickupTime),
    pickupLocation: pickDeep(payload, [
      'pickuplocation',
      'pickup_location',
      'pickuplocationname',
      'pickup_location_name',
      'locationout',
    ]),
    dropoff: joinDateTime(dropoffDate, dropoffTime),
    dropoffLocation: pickDeep(payload, [
      'dropofflocation',
      'dropoff_location',
      'dropofflocationname',
      'dropoff_location_name',
      'returnlocation',
      'locationin',
    ]),
    vehicle: pickDeep(payload, [
      'vehicle',
      'vehicledescription',
      'vehiclecategory',
      'vehiclecategoryname',
      'vehiclecategorytype',
      'categoryfriendlydescription',
      'category',
    ]),
    total: pickDeep(payload, ['total', 'totalcost', 'total_cost', 'grandtotal', 'grand_total', 'amount']),
    source: pickDeep(payload, [
      'bookingagency',
      'booking_agency',
      'agency',
      'agencyname',
      'agent',
      'agentname',
      'travelagent',
      'bookedby',
      'source',
      'channel',
      'companyname',
    ]),
    status: pickDeep(payload, ['status', 'bookingstatus', 'booking_status']),
    cancellationReason: pickDeep(payload, [
      'cancellationreason',
      'cancellation_reason',
      'cancelreason',
      'cancel_reason',
      'reason',
    ]),
  }
}

function moneyText(value: string) {
  const number = Number(value)
  if (!Number.isFinite(number)) return value
  return `NZD ${number.toFixed(2)}`
}

function buildTelegramText(event: RcmAutomationEvent, booking: NormalizedAutomationBooking) {
  const ref = booking.bookingRef || booking.reservationNo || 'Unknown'
  const title = event === 'cancelled' ? '<b>RCM Booking Cancelled</b>' : '<b>New RCM Booking</b>'
  const status = event === 'cancelled' ? 'Cancelled' : (booking.status || 'Created')

  return [
    title,
    `<b>Status: ${escapeTelegramHtml(status)}</b>`,
    `Ref: <b>${escapeTelegramHtml(ref)}</b>`,
    booking.reservationNo && booking.reservationNo !== ref ? `Reservation No: ${escapeTelegramHtml(booking.reservationNo)}` : '',
    booking.customerName ? `Customer: ${escapeTelegramHtml(booking.customerName)}` : '',
    booking.email ? `Email: ${escapeTelegramHtml(booking.email)}` : '',
    booking.phone ? `Phone: ${escapeTelegramHtml(booking.phone)}` : '',
    booking.pickup || booking.pickupLocation
      ? `Pickup: ${escapeTelegramHtml(booking.pickup || '—')} · ${escapeTelegramHtml(booking.pickupLocation || '—')}`
      : '',
    booking.dropoff || booking.dropoffLocation
      ? `Dropoff: ${escapeTelegramHtml(booking.dropoff || '—')} · ${escapeTelegramHtml(booking.dropoffLocation || '—')}`
      : '',
    booking.vehicle ? `Vehicle: ${escapeTelegramHtml(booking.vehicle)}` : '',
    booking.total ? `Total: ${escapeTelegramHtml(moneyText(booking.total))}` : '',
    booking.source ? `Source: ${escapeTelegramHtml(booking.source)}` : 'Source: RCM Automation',
    event === 'cancelled' && booking.cancellationReason
      ? `Reason: ${escapeTelegramHtml(booking.cancellationReason)}`
      : '',
  ].filter(Boolean).join('\n')
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.RCM_WEBHOOK_SECRET || process.env.CRON_SECRET
  if (!secret) return true

  const querySecret = request.nextUrl.searchParams.get('secret')
  if (querySecret && querySecret === secret) return true

  const auth = request.headers.get('authorization') || ''
  if (auth === `Bearer ${secret}`) return true

  const headerSecret = request.headers.get('x-rcm-webhook-secret') || request.headers.get('x-webhook-secret')
  return headerSecret === secret
}

async function parsePayload(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return request.json()

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const entries = Object.fromEntries(formData.entries())
    const payload = entries.payload || entries.data || entries.booking || entries.body
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload)
      } catch {}
    }
    return entries
  }

  const text = await request.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

async function upsertNotification(event: RcmAutomationEvent, booking: NormalizedAutomationBooking, payload: unknown) {
  const key = booking.bookingRef || booking.reservationNo
  if (!key) return { skipped: 'missing booking reference' }

  const supabase = getSupabaseAdmin()
  const { data: existing, error: readError } = await supabase
    .from('telegram_rcm_booking_notifications')
    .select('booking_ref, status, first_notified_at, last_notified_at')
    .eq('booking_ref', key)
    .maybeSingle()

  if (readError) throw new Error(`Supabase read failed: ${readError.message}`)

  const nextStatus = event === 'cancelled' ? 'cancelled' : (booking.status || 'created')
  if (existing && event === 'created') {
    const { error } = await supabase
      .from('telegram_rcm_booking_notifications')
      .update({
        reservation_no: booking.reservationNo || null,
        status: existing.status || nextStatus,
        customer_name: booking.customerName || '',
        last_seen_at: new Date().toISOString(),
        payload,
      })
      .eq('booking_ref', key)
    if (error) throw new Error(`Supabase update failed: ${error.message}`)
    return { skipped: 'already notified' }
  }

  if (existing && event === 'cancelled' && String(existing.status || '').toLowerCase() === 'cancelled') {
    return { skipped: 'already cancelled' }
  }

  await sendTelegramMessage({ text: buildTelegramText(event, booking) })

  const now = new Date().toISOString()
  const { error } = await supabase.from('telegram_rcm_booking_notifications').upsert({
    booking_ref: key,
    reservation_no: booking.reservationNo || null,
    status: nextStatus,
    customer_name: booking.customerName || '',
    pickup_date: booking.pickup || null,
    dropoff_date: booking.dropoff || null,
    first_notified_at: existing?.first_notified_at || now,
    last_notified_at: now,
    last_seen_at: now,
    payload,
  })
  if (error) throw new Error(`Supabase upsert failed: ${error.message}`)

  return { notified: true }
}

export async function handleRcmAutomationWebhook(request: NextRequest, event: RcmAutomationEvent) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await parsePayload(request)
    const booking = normalizeBooking(payload)
    const result = await upsertNotification(event, booking, payload)

    return NextResponse.json({
      success: true,
      event,
      bookingRef: booking.bookingRef || booking.reservationNo || null,
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[rcm automation webhook:${event}] error:`, message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function handleRcmAutomationHealthcheck(request: NextRequest, event: RcmAutomationEvent) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    success: true,
    event,
    message: 'RCM automation webhook is ready. Use POST for booking payloads.',
  })
}
