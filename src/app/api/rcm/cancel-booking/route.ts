export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'
import { evaluateOwnership, logOwnership } from '@/lib/rental-ownership-guard'

function cleanRef(value: any) {
  return String(value || '').trim().replace(/^#/, '')
}

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
      reservationNo,
      cancelReasonId,
      notes,
      // booking & customer details passed from frontend for notifications
      bookingDetails,
      customerDetails,
      lastName,
    } = await req.json()

    if (!reservationRef) {
      return NextResponse.json({ success: false, error: 'Missing reservation reference.' }, { status: 400 })
    }

    // Step 0: Read the booking once, before anything is changed.
    //
    // This has to come first for two reasons. The caller's right to cancel is
    // checked against the customer on file, and checking after the fact would
    // be no check at all. And the amount paid is read here rather than after
    // cancellation, because a cancelled booking comes back from the supplier
    // with its money fields zeroed.
    const surname = String(lastName || customerDetails?.lastName || '').trim()
    const claimedEmail = String(
      customerDetails?.email || bookingDetails?.email || '',
    ).trim()

    let bookingInfo: any = null
    try {
      bookingInfo = await rcmCall('bookinginfo', {
        reservationref: cleanRef(reservationRef),
        lastname: surname,
      })
    } catch (lookupErr: any) {
      console.warn(
        '[cancel-booking] could not read the booking from the supplier:',
        lookupErr?.message,
      )
    }

    const ownership = evaluateOwnership(bookingInfo, {
      lastName: surname,
      email: claimedEmail,
    })
    logOwnership('cancel-booking', cleanRef(reservationRef), ownership, {
      lastName: surname,
      email: claimedEmail,
    })
    if (ownership.shouldBlock) {
      return NextResponse.json(
        {
          success: false,
          error:
            'We could not match those details to this booking. Please check the surname or email used to book.',
          code: 'OWNERSHIP_UNVERIFIED',
        },
        { status: 403 },
      )
    }

    // Step 1: Cancel the booking in RCM
    try {
      await rcmCall('cancelbooking', {
        reservationref: cleanRef(reservationRef),
        reasonid: cancelReasonId ?? 0,
        notes: notes || '',
      })
    } catch (firstErr: any) {
      const asNumber = Number(cleanRef(reservationNo))
      if (!Number.isFinite(asNumber) || asNumber <= 0) throw firstErr
      console.warn('[cancel-booking] reservationref cancel failed, retrying reservationno:', firstErr.message)
      await rcmCall('cancelbooking', {
        reservationno: asNumber,
        reasonid: cancelReasonId ?? 0,
        notes: notes || '',
      })
    }

    // Step 2: Attempt automatic refund via RCM payment transaction.
    //
    // The refund amount comes from the booking read in step 0, never from the
    // request: `bookingDetails.paidAmount` is client-supplied, so trusting it
    // would let a caller choose how much to refund themselves. Field names are
    // taken from a real bookinginfo response — the amount already taken sits
    // at bookinginfo[0].payment, with the individual transactions listed under
    // paymentinfo. No figure from the supplier means no refund.
    let refundSuccess = false
    let refundError = ''
    let paidAmount = 0

    {
      const booking = Array.isArray(bookingInfo?.bookinginfo)
        ? bookingInfo.bookinginfo[0]
        : bookingInfo?.bookinginfo
      let paidFromSupplier = Number(booking?.payment ?? 0)

      if (!(paidFromSupplier > 0) && Array.isArray(bookingInfo?.paymentinfo)) {
        paidFromSupplier = bookingInfo.paymentinfo.reduce(
          (total: number, item: any) =>
            total + (Number(item?.amount ?? item?.paymentamount ?? 0) || 0),
          0,
        )
      }

      if (Number.isFinite(paidFromSupplier) && paidFromSupplier > 0) {
        paidAmount = paidFromSupplier
      }
    }

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
