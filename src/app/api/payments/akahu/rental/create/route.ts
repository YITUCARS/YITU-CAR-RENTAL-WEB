export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAkahuRentalPayment } from '@/lib/akahu-rental'
import { checkRentalPaymentAmount } from '@/lib/rental-amount-guard'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const reservationRef = String(body.reservationRef || '').trim()
    const amount = Math.round(Number(body.amount) * 100) / 100
    if (!reservationRef || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Missing reservation reference or payment amount.' }, { status: 400 })
    }
    const guard = await checkRentalPaymentAmount({
      reservationRef,
      lastName: String(body.lastName || '').trim(),
      submittedCents: Math.round(amount * 100),
    })
    if (guard.shouldBlock) {
      return NextResponse.json({ success: false, error: 'The payment amount does not match this booking.', code: 'AMOUNT_MISMATCH' }, { status: 400 })
    }
    const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin
    const payment = await createAkahuRentalPayment({ reservationRef, amount, origin })
    return NextResponse.json({
      success: true,
      akahuPaymentId: payment._id,
      akahuPaymentPageUrl: payment.authorisation_url,
      expiresAt: payment.expires_at || '',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start Akahu payment.'
    console.error('[akahu rental create] error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
