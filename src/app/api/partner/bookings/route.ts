import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { readPartnerSession } from '@/lib/partner-auth'
import { rcmCall } from '@/lib/rcm'

function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T12:00:00Z`).getTime()
  const b = new Date(`${to}T12:00:00Z`).getTime()
  return Math.max(1, Math.ceil((b - a) / 86400000))
}

export async function GET(req: NextRequest) {
  const session = readPartnerSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await getSupabaseAdmin().from('partner_bookings').select('*').eq('partner_account_id', session.id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bookings: data || [] })
}

export async function DELETE(req: NextRequest) {
  const session = readPartnerSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const reference = String(body.reference || '').trim()
  if (!reference) return NextResponse.json({ error: '缺少企业订单编号' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data: booking, error: lookupError } = await supabase
    .from('partner_bookings')
    .select('*')
    .eq('partner_account_id', session.id)
    .eq('reference', reference)
    .maybeSingle()
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!booking) return NextResponse.json({ error: '找不到这笔企业订单' }, { status: 404 })
  if (String(booking.status).toLowerCase() === 'cancelled') return NextResponse.json({ success: true, booking })

  const reservationRef = String(booking.rcm_reservation_ref || '').trim()
  const reservationNo = Number(booking.rcm_reservation_no || 0)
  if (!reservationRef && !(reservationNo > 0)) return NextResponse.json({ error: '这笔订单没有有效的 RCM 预订编号，无法自动取消' }, { status: 400 })

  const cancelNotes = String(body.notes || 'Cancelled by corporate account').trim()
  try {
    try {
      if (reservationRef) {
        await rcmCall('cancelbooking', { reservationref: reservationRef, reasonid: Number(body.reasonId || 0), notes: cancelNotes })
      } else {
        await rcmCall('cancelbooking', { reservationno: reservationNo, reasonid: Number(body.reasonId || 0), notes: cancelNotes })
      }
    } catch (firstError: any) {
      if (reservationRef && reservationNo > 0) {
        await rcmCall('cancelbooking', { reservationno: reservationNo, reasonid: Number(body.reasonId || 0), notes: cancelNotes })
      } else throw firstError
    }
  } catch (error: any) {
    return NextResponse.json({ error: `RCM 取消失败：${error?.message || '请稍后重试'}` }, { status: 502 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('partner_bookings')
    .update({ status: 'cancelled', notes: [booking.notes, cancelNotes].filter(Boolean).join(' · ') })
    .eq('partner_account_id', session.id)
    .eq('reference', reference)
    .select()
    .single()
  if (updateError) return NextResponse.json({ error: `RCM 已取消，但账单状态更新失败：${updateError.message}`, code: 'PARTNER_STATUS_UPDATE_FAILED' }, { status: 500 })
  return NextResponse.json({ success: true, booking: updated })
}

export async function POST(req: NextRequest) {
  const session = readPartnerSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const days = daysBetween(String(body.pickupDate || ''), String(body.dropoffDate || ''))
  const originalTotal = Math.max(0, Number(body.originalTotal || 0))
  const discountPercent = Math.min(100, Math.max(0, Number(session.discountPercent || 0)))
  const partnerTotal = body.partnerTotal !== undefined
    ? Math.max(0, Number(body.partnerTotal || 0))
    : Math.round(originalTotal * (1 - discountPercent / 100) * 100) / 100
  const contactEmail = String(body.customerEmail || '').trim()
  const contactPhone = String(body.customerPhone || '').trim()
  if (!body.pickupDate || !body.dropoffDate || !body.vehicleName || !contactEmail || !contactPhone) return NextResponse.json({ error: '请先填写企业邮箱和电话' }, { status: 400 })
  await getSupabaseAdmin().from('partner_accounts').update({ contact_email: contactEmail, contact_phone: contactPhone }).eq('id', session.id)
  const reference = `CP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
  const bookingRow = {
    partner_account_id: session.id, reference, rcm_reservation_ref: String(body.rcmReservationRef || ''), rcm_reservation_no: String(body.rcmReservationNo || ''), customer_name: String(session.displayName || '企业客户').trim(), customer_email: contactEmail, customer_phone: contactPhone,
    pickup_location: String(body.pickupLocation || ''), dropoff_location: String(body.dropoffLocation || ''), pickup_date: body.pickupDate, dropoff_date: body.dropoffDate, pickup_time: String(body.pickupTime || '10:00'), dropoff_time: String(body.dropoffTime || '10:00'),
    vehicle_id: String(body.vehicleId || ''), vehicle_name: String(body.vehicleName), days, original_total: originalTotal, partner_total: partnerTotal, discount_percent: discountPercent, pricing_breakdown: body.pricingBreakdown || {}, notes: String(body.notes || '').trim()
  }
  let { data, error } = await getSupabaseAdmin().from('partner_bookings').insert(bookingRow).select().single()
  // Keep bookings working if an older database migration was applied before
  // the RCM reference columns were added. The SQL migration remains the
  // preferred fix so future statements include both references.
  if (error && /rcm_reservation_(ref|no)|pricing_breakdown|column .* does not exist/i.test(error.message)) {
    const { rcm_reservation_ref: _ref, rcm_reservation_no: _no, pricing_breakdown: _breakdown, ...legacyRow } = bookingRow
    const retry = await getSupabaseAdmin().from('partner_bookings').insert(legacyRow).select().single()
    data = retry.data
    error = retry.error
  }
  if (error) return NextResponse.json({ error: `企业账单写入失败：${error.message}`, code: 'PARTNER_BOOKING_SAVE_FAILED' }, { status: 500 })
  return NextResponse.json({ success: true, booking: data })
}
