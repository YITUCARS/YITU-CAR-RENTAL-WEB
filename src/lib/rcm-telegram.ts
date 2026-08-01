import { rcmCallWithApiKey, toRCMDate } from '@/lib/rcm'
import { normalizeBooking, pickString } from '@/lib/staff-api'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { escapeTelegramHtml, sendTelegramMessage } from '@/lib/telegram'

const DEFAULT_SYNC_DAYS_AHEAD = 180

function todayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDays(ymd: string, days: number) {
  const date = new Date(`${ymd}T00:00:00`)
  date.setDate(date.getDate() + days)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function parseRows(raw: any) {
  return Array.isArray(raw) ? raw : raw?.bookings || raw?.agentbookings || raw?.results || []
}

function uniqueBookingKey(booking: any) {
  return String(booking.bookingRef || booking.reservationNo || booking.id || '').trim()
}

function formatMoney(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number.toFixed(2) : '0.00'
}

function buildSourceLabel(booking: any) {
  return pickString(booking.raw || {}, ['bookedby', 'source', 'bookingchannel', 'bookingChannel', 'travelagent', 'companyname'], 'RCM')
}

function buildNewBookingMessage(booking: any) {
  const ref = escapeTelegramHtml(uniqueBookingKey(booking))
  const customer = escapeTelegramHtml(booking.customerName)
  const pickup = escapeTelegramHtml(`${booking.pickupDate || '—'} ${booking.pickupTime || ''}`.trim())
  const dropoff = escapeTelegramHtml(`${booking.dropoffDate || '—'} ${booking.dropoffTime || ''}`.trim())
  const vehicle = escapeTelegramHtml(booking.vehicleModel)
  const total = formatMoney(booking.total)
  const source = escapeTelegramHtml(buildSourceLabel(booking))
  const status = escapeTelegramHtml(booking.status || 'unknown')

  return [
    '<b>New RCM Booking</b>',
    `Ref: <b>${ref}</b>`,
    `Customer: ${customer}`,
    `Pickup: ${pickup} · ${escapeTelegramHtml(booking.pickupLocation)}`,
    `Dropoff: ${dropoff} · ${escapeTelegramHtml(booking.dropoffLocation)}`,
    `Vehicle: ${vehicle}`,
    `Total: NZD ${total}`,
    `Source: ${source}`,
    `Status: ${status}`,
  ].join('\n')
}

function buildStatusChangeMessage(previous: any, booking: any) {
  const ref = escapeTelegramHtml(uniqueBookingKey(booking))
  return [
    '<b>RCM Booking Updated</b>',
    `Ref: <b>${ref}</b>`,
    `Customer: ${escapeTelegramHtml(booking.customerName)}`,
    `Status: ${escapeTelegramHtml(previous.status || 'unknown')} → ${escapeTelegramHtml(booking.status || 'unknown')}`,
    `Pickup: ${escapeTelegramHtml(`${booking.pickupDate || '—'} ${booking.pickupTime || ''}`.trim())}`,
  ].join('\n')
}

function pickFirst(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

function normalizeSourceLabel(body: any) {
  const raw = String(body?.source || body?.bookingSource || body?.paymentChannel || '').toLowerCase()
  if (raw.includes('wechat') || raw.includes('wx') || raw.includes('mini')) return 'YITU WeChat Mini Program'
  if (raw.includes('vantu')) return 'Vantu App'
  return 'YITU Website'
}

export async function notifyWebsiteBookingCreated(params: { body: any; result: any }) {
  const supabase = getSupabaseAdmin()
  const { body, result } = params
  const reservationRef = pickFirst(result?.reservationref, result?.reservationRef, result?.refno, result?.bookingref)
  const reservationNo = pickFirst(result?.reservationno, result?.reservationNo, result?.reservationnumber)
  const key = pickFirst(reservationRef, reservationNo)
  if (!key) return { notified: false, skipped: 'missing booking reference' }

  const customerName = `${pickFirst(body?.firstName)} ${pickFirst(body?.lastName)}`.trim()
  const sourceLabel = normalizeSourceLabel(body)
  const booking = {
    bookingRef: reservationRef || key,
    reservationNo: reservationNo || null,
    customerName,
    pickupDate: pickFirst(body?.pickupDate),
    pickupTime: pickFirst(body?.pickupTime, '10:00'),
    dropoffDate: pickFirst(body?.dropoffDate),
    dropoffTime: pickFirst(body?.dropoffTime, '10:00'),
    pickupLocation: pickFirst(body?.pickupLocation, body?.pickupLocationName, body?.pickupLocationId),
    dropoffLocation: pickFirst(body?.dropoffLocation, body?.dropoffLocationName, body?.dropoffLocationId),
    vehicleModel: pickFirst(body?.vehicleName, body?.vehicleCategoryName, body?.vehicleCategoryId),
    total: Number(body?.totalAmount ?? body?.grandTotal ?? body?.totalPrice ?? body?.total ?? result?.total ?? result?.totalcost ?? 0),
    status: 'awaiting_payment',
    raw: {
      ...result,
      bookedby: sourceLabel,
      paymentType: body?.paymentType || 'unknown',
      email: body?.email || '',
      phone: body?.phone || '',
      promoCode: body?.promoCode || '',
    },
  }

  try {
    const { data: existing, error: readError } = await supabase
      .from('telegram_rcm_booking_notifications')
      .select('booking_ref')
      .eq('booking_ref', key)
      .maybeSingle()

    if (readError) {
      console.warn('[rcm-telegram] Supabase dedupe read failed:', readError.message)
    } else if (existing) {
      return { notified: false, skipped: 'already notified' }
    }
  } catch (error) {
    console.warn('[rcm-telegram] Supabase dedupe read failed:', error instanceof Error ? error.message : error)
  }

  await sendTelegramMessage({
    text: [
      '<b>New Website Booking</b>',
      '<b>Status: Awaiting payment</b>',
      `Ref: <b>${escapeTelegramHtml(booking.bookingRef)}</b>`,
      reservationNo ? `Reservation No: ${escapeTelegramHtml(reservationNo)}` : '',
      `Customer: ${escapeTelegramHtml(customerName || '—')}`,
      body?.email ? `Email: ${escapeTelegramHtml(body.email)}` : '',
      body?.phone ? `Phone: ${escapeTelegramHtml(body.phone)}` : '',
      `Pickup: ${escapeTelegramHtml(`${booking.pickupDate || '—'} ${booking.pickupTime || ''}`.trim())} · ${escapeTelegramHtml(booking.pickupLocation)}`,
      `Dropoff: ${escapeTelegramHtml(`${booking.dropoffDate || '—'} ${booking.dropoffTime || ''}`.trim())} · ${escapeTelegramHtml(booking.dropoffLocation)}`,
      `Vehicle: ${escapeTelegramHtml(booking.vehicleModel)}`,
      `Total: NZD ${formatMoney(booking.total)}`,
      `Payment: ${escapeTelegramHtml(body?.paymentType || 'selected, not paid yet')}`,
      body?.promoCode ? `Promo: ${escapeTelegramHtml(body.promoCode)}` : '',
      `Source: ${escapeTelegramHtml(sourceLabel)}`,
    ].filter(Boolean).join('\n'),
  })

  const now = new Date().toISOString()
  try {
    const { error } = await supabase.from('telegram_rcm_booking_notifications').upsert({
      booking_ref: key,
      reservation_no: reservationNo || null,
      status: booking.status,
      customer_name: customerName,
      pickup_date: booking.pickupDate || null,
      dropoff_date: booking.dropoffDate || null,
      first_notified_at: now,
      last_notified_at: now,
      last_seen_at: now,
      payload: booking,
    })
    if (error) console.warn('[rcm-telegram] Supabase notification insert failed:', error.message)
  } catch (error) {
    console.warn('[rcm-telegram] Supabase notification insert failed:', error instanceof Error ? error.message : error)
  }

  return { notified: true }
}

export async function notifyWebsitePaymentReceived(params: {
  reservationRef: string
  amount: number
  paymentIntentId: string
  chargeId?: string
  paymentMethod?: string
  paymentChannel?: string
}) {
  const key = pickFirst(params.reservationRef)
  if (!key) return { notified: false, skipped: 'missing booking reference' }

  let alreadyPaid = false
  let existing: any = null
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('telegram_rcm_booking_notifications')
      .select('booking_ref, reservation_no, status, payload')
      .eq('booking_ref', key)
      .maybeSingle()

    if (error) {
      console.warn('[rcm-telegram] Supabase payment dedupe read failed:', error.message)
    } else {
      existing = data
      alreadyPaid = String(data?.status || '').toLowerCase() === 'paid'
    }
  } catch (error) {
    console.warn('[rcm-telegram] Supabase payment dedupe read failed:', error instanceof Error ? error.message : error)
  }

  if (alreadyPaid) return { notified: false, skipped: 'already notified' }

  const payload = existing?.payload || {}
  const customer = pickFirst(payload.customerName, payload.raw?.customerName, payload.raw?.email)
  const vehicle = pickFirst(payload.vehicleModel)
  const pickup = pickFirst(`${payload.pickupDate || ''} ${payload.pickupTime || ''}`.trim())
  const dropoff = pickFirst(`${payload.dropoffDate || ''} ${payload.dropoffTime || ''}`.trim())
  const method = String(params.paymentMethod || '').toLowerCase()
  const channel = String(params.paymentChannel || '').toLowerCase()
  const isWechat = method.includes('wechat') || channel.includes('wechat') || channel.includes('mini')
  const title = isWechat ? '<b>WeChat Mini Program Payment Received</b>' : '<b>Website Payment Received</b>'
  const transactionLabel = isWechat ? 'WeChat Trade No' : 'Stripe PI'

  await sendTelegramMessage({
    text: [
      title,
      '<b>Status: Paid</b>',
      `Ref: <b>${escapeTelegramHtml(key)}</b>`,
      customer ? `Customer: ${escapeTelegramHtml(customer)}` : '',
      vehicle ? `Vehicle: ${escapeTelegramHtml(vehicle)}` : '',
      pickup ? `Pickup: ${escapeTelegramHtml(pickup)}` : '',
      dropoff ? `Dropoff: ${escapeTelegramHtml(dropoff)}` : '',
      `Paid: NZD ${formatMoney(params.amount)}`,
      params.paymentMethod ? `Method: ${escapeTelegramHtml(params.paymentMethod.toUpperCase())}` : '',
      params.paymentChannel ? `Channel: ${escapeTelegramHtml(params.paymentChannel)}` : '',
      `${transactionLabel}: ${escapeTelegramHtml(params.paymentIntentId)}`,
      params.chargeId ? `Charge: ${escapeTelegramHtml(params.chargeId)}` : '',
    ].filter(Boolean).join('\n'),
  })

  try {
    const supabase = getSupabaseAdmin()
    const now = new Date().toISOString()
    const nextPayload = {
      ...payload,
      status: 'paid',
      paidAmount: params.amount,
      paidAt: now,
      paymentIntentId: params.paymentIntentId,
      chargeId: params.chargeId || '',
      paymentMethod: params.paymentMethod || '',
      paymentChannel: params.paymentChannel || '',
    }
    const { error } = await supabase.from('telegram_rcm_booking_notifications').upsert({
      booking_ref: key,
      reservation_no: existing?.reservation_no || null,
      status: 'paid',
      customer_name: pickFirst(payload.customerName),
      pickup_date: payload.pickupDate || null,
      dropoff_date: payload.dropoffDate || null,
      first_notified_at: existing ? undefined : now,
      last_notified_at: now,
      last_seen_at: now,
      payload: nextPayload,
    })
    if (error) console.warn('[rcm-telegram] Supabase payment notification update failed:', error.message)
  } catch (error) {
    console.warn('[rcm-telegram] Supabase payment notification update failed:', error instanceof Error ? error.message : error)
  }

  return { notified: true }
}

export async function fetchUpcomingAgentBookings() {
  const agentApiKey = process.env.RCM_AGENT_API_KEY
  if (!agentApiKey) throw new Error('RCM_AGENT_API_KEY is required for Telegram order sync.')

  const start = todayYmd()
  const daysAhead = Number(process.env.RCM_BOOKING_SYNC_DAYS_AHEAD || DEFAULT_SYNC_DAYS_AHEAD)
  const end = addDays(start, Number.isFinite(daysAhead) ? daysAhead : DEFAULT_SYNC_DAYS_AHEAD)

  const raw = await rcmCallWithApiKey(agentApiKey, 'agentbookings', {
    startdate: toRCMDate(start),
    enddate: toRCMDate(end),
    reservationno: 0,
  })

  const deduped = new Map<string, any>()
  for (const row of parseRows(raw)) {
    const booking = normalizeBooking(row, 'pickup')
    const key = uniqueBookingKey(booking)
    if (!key) continue
    if (String(booking.status || '').includes('cancel')) continue
    deduped.set(key, booking)
  }

  return Array.from(deduped.values())
}

export async function syncRcmBookingsToTelegram() {
  const supabase = getSupabaseAdmin()
  const bookings = await fetchUpcomingAgentBookings()
  const keys = bookings.map(uniqueBookingKey).filter(Boolean)

  const existingMap = new Map<string, any>()
  if (keys.length) {
    const { data, error } = await supabase
      .from('telegram_rcm_booking_notifications')
      .select('booking_ref, reservation_no, status, payload, first_notified_at, last_notified_at, last_seen_at')
      .in('booking_ref', keys)

    if (error) throw new Error(`Supabase read failed: ${error.message}`)
    for (const row of data || []) existingMap.set(String(row.booking_ref), row)
  }

  let created = 0
  let updated = 0
  let statusChanges = 0
  const notifyStatusChanges = String(process.env.TELEGRAM_NOTIFY_STATUS_CHANGES || '').toLowerCase() === 'true'

  for (const booking of bookings) {
    const key = uniqueBookingKey(booking)
    if (!key) continue

    const existing = existingMap.get(key)
    const record = {
      booking_ref: key,
      reservation_no: booking.reservationNo || null,
      status: booking.status || '',
      customer_name: booking.customerName || '',
      pickup_date: booking.pickupDate || null,
      dropoff_date: booking.dropoffDate || null,
      last_seen_at: new Date().toISOString(),
      payload: booking,
    }

    if (!existing) {
      await sendTelegramMessage({ text: buildNewBookingMessage(booking) })
      const { error } = await supabase.from('telegram_rcm_booking_notifications').upsert({
        ...record,
        first_notified_at: new Date().toISOString(),
        last_notified_at: new Date().toISOString(),
      })
      if (error) throw new Error(`Supabase insert failed: ${error.message}`)
      created += 1
      continue
    }

    const patch: Record<string, any> = {
      ...record,
      last_notified_at: existing.last_notified_at || existing.first_notified_at || new Date().toISOString(),
    }

    if (notifyStatusChanges && existing.status && booking.status && existing.status !== booking.status) {
      await sendTelegramMessage({ text: buildStatusChangeMessage(existing, booking) })
      patch.last_notified_at = new Date().toISOString()
      statusChanges += 1
    }

    const { error } = await supabase
      .from('telegram_rcm_booking_notifications')
      .update(patch)
      .eq('booking_ref', key)

    if (error) throw new Error(`Supabase update failed: ${error.message}`)
    updated += 1
  }

  return { scanned: bookings.length, created, updated, statusChanges }
}
