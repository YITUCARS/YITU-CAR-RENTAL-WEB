// Online check-in: staff send the hirer a private link before pick-up; the hirer confirms their
// details, licence and flight, uploads licence photos and accepts the terms. Everything is
// written to the RCM booking. Table: supabase/online-checkins.sql.

import { createHash, randomBytes } from 'crypto'
import { getStaffBookingDetail } from '@/lib/staff-api'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const SITE = process.env.PUBLIC_SITE_URL || 'https://www.yiturentalcars.co.nz'
const FROM = process.env.STAFF_EMAIL_FROM || 'YITU Car Rental <booking@yiturentalcars.co.nz>'
const REPLY_TO = process.env.STAFF_EMAIL_REPLY_TO || 'booking@yiturentalcars.co.nz'

export type CheckinStatus = 'sent' | 'opened' | 'submitted' | 'cancelled'

export type CheckinRow = {
  id: string
  booking_ref: string
  reservation_no: string
  status: CheckinStatus
  email: string
  sent_by: string
  sent_at: string
  opened_at: string | null
  submitted_at: string | null
  expires_at: string
  data: Record<string, any> | null
  photos: string[]
  rcm_synced_at: string | null
  rcm_error: string | null
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export const checkinLink = (token: string) => `${SITE}/checkin/${token}`

const nzToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export class CheckinError extends Error {}

/**
 * Creates a new link for the booking (earlier unused links stop working) and emails it.
 * Returns the link too, so staff can also share it another way (e.g. WeChat).
 */
export async function sendCheckinLink(params: { reservationRef: string; staffId: string; to?: string }) {
  const booking = await getStaffBookingDetail(params.reservationRef, 'pickup')
  if (!booking.bookingRef) throw new CheckinError('Booking not found in RCM.')
  if (booking.status === 'completed') throw new CheckinError('This booking has already been picked up.')
  if (!booking.pickupDate || booking.pickupDate < nzToday()) throw new CheckinError('The pick-up date has passed.')

  const to = String(params.to || booking.customer?.email || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new CheckinError('No valid customer email. Enter one in the app.')

  const token = randomBytes(24).toString('base64url')
  // Valid until the end of the pick-up day (noon UTC the next day = 00:00–01:00 NZ time).
  const expiresAt = new Date(Date.parse(`${booking.pickupDate}T12:00:00Z`) + 86400000).toISOString()

  const supabase = getSupabaseAdmin()
  await supabase.from('online_checkins')
    .update({ status: 'cancelled' })
    .eq('booking_ref', booking.bookingRef)
    .in('status', ['sent', 'opened'])
  const { error } = await supabase.from('online_checkins').insert({
    booking_ref: booking.bookingRef,
    reservation_no: booking.reservationNo,
    token_hash: hashToken(token),
    email: to,
    sent_by: params.staffId,
    expires_at: expiresAt,
  })
  if (error) throw new Error(`Could not save the check-in link: ${error.message}`)

  const link = checkinLink(token)
  await sendEmail(to, link, booking)
  return { link, to, expiresAt }
}

async function sendEmail(to: string, link: string, booking: Awaited<ReturnType<typeof getStaffBookingDetail>>) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Email is not configured (RESEND_API_KEY).')
  const name = booking.customer?.firstName || booking.customerName || 'there'
  const ref = booking.reservationNo || booking.bookingRef
  const when = `${booking.pickupDate} ${booking.pickupTime} · ${booking.pickupLocation}`
  const subject = `Check in online before you collect your car – #${ref} | 在线办理取车手续`
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#0f1728;max-width:560px">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Save time at the counter: check in online before you collect your car. It takes about 3 minutes —
      confirm your details, add your flight and upload photos of your driver licence.</p>
      <p style="color:#5c6a80">您好！取车前可以先在线办理手续：核对个人信息、填写航班号、上传驾照照片，大约 3 分钟，到店取车更快。</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#e8431a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">Check in online · 在线办理</a></p>
      <table style="border-collapse:collapse;margin:8px 0 16px">
        <tr><td style="padding:4px 14px 4px 0;color:#7a8699;font-size:13px">Booking</td><td style="padding:4px 0;font-size:14px">#${escapeHtml(ref)}</td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#7a8699;font-size:13px">Pick up</td><td style="padding:4px 0;font-size:14px">${escapeHtml(when)}</td></tr>
      </table>
      <p style="color:#7a8699;font-size:13px">This link is for your booking only and works until your pick-up day. Please bring your original driver licence when you collect the car.<br/>
      此链接仅限本订单使用，取车当天后失效。取车时请携带驾照原件。</p>
      <p>See you soon,<br/>YITU Car Rental · +64 27 3922666</p>
    </div>`
  const text = `Hi ${name},\n\nCheck in online before you collect your car (about 3 minutes):\n${link}\n\n取车前在线办理手续（约 3 分钟）：\n${link}\n\nBooking #${ref}\nPick up: ${when}\n\nPlease bring your original driver licence. 取车时请携带驾照原件。\nYITU Car Rental · +64 27 3922666`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html, text }),
  })
  if (!res.ok) throw new Error(`Email was not sent: ${res.status} ${(await res.text()).slice(0, 200)}`)
}

/** The live check-in for a link token, or null if the link is unknown, replaced or expired. */
export async function findCheckin(token: string): Promise<CheckinRow | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const { data } = await getSupabaseAdmin().from('online_checkins')
    .select('*').eq('token_hash', hashToken(token)).maybeSingle()
  const row = data as CheckinRow | null
  if (!row || row.status === 'cancelled' || Date.parse(row.expires_at) < Date.now()) return null
  return row
}

export async function updateCheckin(id: string, changes: Partial<CheckinRow>) {
  const { error } = await getSupabaseAdmin().from('online_checkins').update(changes).eq('id', id)
  if (error) throw new Error(`Could not save the check-in: ${error.message}`)
}

/** Latest check-in per booking, for YITU Lite's badges. */
export async function latestCheckins(bookingRefs: string[]) {
  if (!bookingRefs.length) return {}
  const { data, error } = await getSupabaseAdmin().from('online_checkins')
    .select('booking_ref,status,email,sent_at,opened_at,submitted_at,rcm_synced_at,rcm_error')
    .in('booking_ref', bookingRefs)
    .neq('status', 'cancelled')
    .order('sent_at', { ascending: false })
  if (error) throw new Error(error.message)
  const out: Record<string, any> = {}
  for (const row of data || []) {
    if (out[row.booking_ref]) continue
    out[row.booking_ref] = {
      status: row.status,
      email: row.email,
      sentAt: row.sent_at,
      openedAt: row.opened_at,
      submittedAt: row.submitted_at,
      rcmSynced: Boolean(row.rcm_synced_at),
      rcmError: row.rcm_error || '',
    }
  }
  return out
}
