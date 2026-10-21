export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmSignatureList } from '@/lib/rcm-post'
import { getStaffBookingDetail, requireStaff } from '@/lib/staff-api'

// POST /api/staff/email-pickup
// Body: { reservationRef, to?, includeAgreement?: boolean, pickupPdfBase64? }  (at least one)
// Emails the hirer whichever documents staff ticked: the signed RCM rental agreement (downloaded
// here from RCM's agreement link, which serves the PDF) and/or the YITU Lite pick-up report. RCM's own `sendemail` only sends its booking confirmation, so
// we send from booking@ and Bcc that inbox as the record. The address defaults to the customer
// email recorded in RCM; staff can override it (e.g. OTA bookings with a masked relay address).

const FROM = process.env.STAFF_EMAIL_FROM || 'YITU Car Rental <booking@yiturentalcars.co.nz>'
const REPLY_TO = process.env.STAFF_EMAIL_REPLY_TO || 'booking@yiturentalcars.co.nz'
const RECORD_BCC = process.env.STAFF_EMAIL_BCC || 'booking@yiturentalcars.co.nz'

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** RCM's agreement link returns the rendered agreement PDF (with any saved signatures). */
async function downloadAgreementPdf(reservationRef: string) {
  const slots = await rcmSignatureList(reservationRef)
  const url = (slots.find(slot => slot.templateId === 0) || slots[0])?.agreementUrl
  if (!url) throw new Error('RCM has no rental agreement for this booking.')
  const res = await fetch(url, { cache: 'no-store' })
  const bytes = Buffer.from(await res.arrayBuffer())
  if (!res.ok || bytes.subarray(0, 5).toString() !== '%PDF-') {
    throw new Error('RCM did not return the rental agreement PDF (the booking may be cancelled).')
  }
  return bytes.toString('base64')
}

function cleanBase64(value: unknown) {
  return String(value || '').replace(/^data:application\/pdf;base64,/, '').replace(/\s/g, '')
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, 'agreements.manage')
  if (auth.response) return auth.response

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ success: false, error: 'Email is not configured (RESEND_API_KEY).' }, { status: 500 })

  try {
    const body = await req.json()
    const reservationRef = String(body.reservationRef || '').trim()
    const pickupPdf = cleanBase64(body.pickupPdfBase64)
    const includeAgreement = Boolean(body.includeAgreement)
    if (!reservationRef || (!pickupPdf && !includeAgreement)) {
      return NextResponse.json({ success: false, error: 'reservationRef and at least one document are required.' }, { status: 400 })
    }

    const booking = await getStaffBookingDetail(reservationRef, 'pickup')
    const to = String(body.to || booking.customer?.email || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ success: false, error: 'No valid customer email. Enter one in the app.' }, { status: 400 })
    }

    const agreementPdf = includeAgreement ? await downloadAgreementPdf(reservationRef) : ''
    const name = booking.customer?.firstName || booking.customerName || 'Customer'
    const ref = booking.reservationNo || reservationRef
    const documents = [agreementPdf && 'rental agreement', pickupPdf && 'pick-up report'].filter(Boolean).join(' & ')
    const documentsZh = [agreementPdf && '已签署的租车合同', pickupPdf && '取车检查报告（含车辆照片）'].filter(Boolean).join('和')
    const subject = `Your YITU ${documents} – #${ref}`
    const rows = [
      ['Vehicle', `${booking.vehicleModel}${booking.vehiclePlate && booking.vehiclePlate !== 'TBC' ? ` (${booking.vehiclePlate})` : ''}`],
      ['Pick up', `${booking.pickupDate} ${booking.pickupTime} · ${booking.pickupLocation}`],
      ['Return', `${booking.dropoffDate} ${booking.dropoffTime} · ${booking.dropoffLocation}`],
    ]
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#0f1728;max-width:560px">
        <p>Hi ${escapeHtml(name)},</p>
        <p>Thank you for renting with YITU Car Rental. Attached is your ${documents}${pickupPdf ? ', including the vehicle photos taken at hand-over' : ''}.</p>
        <p style="color:#7a8699">感谢您选择易途租车。附件是您的${documentsZh}，请妥善保存。</p>
        <table style="border-collapse:collapse;margin:16px 0">${rows.map(([label, value]) => `<tr><td style="padding:4px 14px 4px 0;color:#7a8699;font-size:13px">${label}</td><td style="padding:4px 0;font-size:14px">${escapeHtml(value)}</td></tr>`).join('')}</table>
        <p>If anything looks wrong, just reply to this email or call +64 27 3922666.</p>
        <p>Safe travels,<br/>YITU Car Rental</p>
      </div>`
    const text = `Hi ${name},\n\nThank you for renting with YITU Car Rental. Attached is your ${documents}.\n感谢您选择易途租车，附件是您的${documentsZh}。\n\n${rows.map(([l, v]) => `${l}: ${v}`).join('\n')}\n\nYITU Car Rental · +64 27 3922666`

    const attachments = [
      ...(agreementPdf ? [{ filename: `YITU-Rental-Agreement-${ref}.pdf`, content: agreementPdf }] : []),
      ...(pickupPdf ? [{ filename: `YITU-Pick-Up-Report-${ref}.pdf`, content: pickupPdf }] : []),
    ]

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], bcc: [RECORD_BCC], reply_to: REPLY_TO, subject, html, text, attachments }),
    })
    if (!res.ok) throw new Error(`Email was not sent: ${res.status} ${(await res.text()).slice(0, 200)}`)

    console.log('[staff/email-pickup]', reservationRef, 'sent by', auth.payload?.staffId, 'attachments', attachments.length)
    return NextResponse.json({ success: true, to, sent: attachments.map(file => file.filename) })
  } catch (err: any) {
    console.error('[staff/email-pickup] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
