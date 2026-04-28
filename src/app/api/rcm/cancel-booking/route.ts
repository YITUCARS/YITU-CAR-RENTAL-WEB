export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

async function sendTelegramAlert(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  try {
    const {
      reservationRef,
      cancelReasonId,
      notes,
      // booking & customer details passed from frontend for notifications
      bookingDetails,
      customerDetails,
    } = await req.json()

    if (!reservationRef) {
      return NextResponse.json({ success: false, error: 'Missing reservation reference.' }, { status: 400 })
    }

    // Step 1: Cancel the booking in RCM
    await rcmCall('cancelbooking', {
      reservationref: reservationRef,
      reasonid: cancelReasonId ?? 0,
      notes: notes || '',
    })

    // Step 2: Attempt automatic refund via RCM payment transaction
    let refundSuccess = false
    let refundError = ''
    const paidAmount = Number(bookingDetails?.paidAmount ?? 0)

    if (paidAmount > 0) {
      try {
        await rcmCall('createpaymenttransaction', {
          paymentgatewaytype: 'VostroPay',
          reservationref: reservationRef,
          transactiontype: 'refund',
          amount: paidAmount,
          payscenario: 1,
          paysource: 'YITU Web Cancellation',
          emailoption: 1,
        })
        refundSuccess = true
        console.log('[cancel-booking] refund transaction created successfully')
      } catch (refundErr: any) {
        refundError = refundErr.message
        console.error('[cancel-booking] refund attempt failed:', refundErr.message)
      }
    }

    // Step 3: Send Telegram notification to staff regardless of refund result
    const vehicle = bookingDetails?.vehicleName ?? 'Unknown vehicle'
    const docNo = bookingDetails?.documentNo ?? reservationRef
    const customerName = customerDetails?.name ?? 'Unknown'
    const customerEmail = customerDetails?.email ?? ''
    const pickup = bookingDetails?.pickupDate ?? ''
    const dropoff = bookingDetails?.dropoffDate ?? ''
    const location = bookingDetails?.location ?? ''
    const paymentType = (bookingDetails?.paymentType ?? '').toUpperCase()

    const refundLine = refundSuccess
      ? `✅ <b>Refund submitted automatically</b> ($${paidAmount.toFixed(2)} ${paymentType})`
      : paidAmount > 0
        ? `⚠️ <b>Manual refund required: $${paidAmount.toFixed(2)} ${paymentType}</b>\nPlease process via payment gateway dashboard (Stripe).\n<i>Auto-refund failed: ${refundError}</i>`
        : `ℹ️ No deposit paid — no refund required`

    const message = [
      `🚫 <b>BOOKING CANCELLED</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📋 Ref: <code>${docNo}</code>`,
      `👤 Customer: ${customerName}${customerEmail ? ` (${customerEmail})` : ''}`,
      `🚗 Vehicle: ${vehicle}`,
      `📅 Period: ${pickup} → ${dropoff}${location ? ` · ${location}` : ''}`,
      notes ? `📝 Reason/Notes: ${notes}` : '',
      ``,
      refundLine,
    ].filter(Boolean).join('\n')

    await sendTelegramAlert(message)

    return NextResponse.json({
      success: true,
      refundSuccess,
      refundError: refundSuccess ? null : refundError,
    })
  } catch (err: any) {
    console.error('[cancel-booking] error:', err.message)
    return NextResponse.json(
      { success: false, error: err.message || 'Cancellation failed. Please contact us directly.' },
      { status: 500 }
    )
  }
}
