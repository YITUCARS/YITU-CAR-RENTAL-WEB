export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { confirmRentalPayment } from '@/lib/rental-payment-confirm'
import { normalizePaymentChannel, normalizeStripeMode } from '@/lib/stripe-rental'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const stripeMode = normalizeStripeMode(body.stripeMode || body.mode)
    const paymentChannel = normalizePaymentChannel(body.paymentChannel)
    const paymentIntentId = String(
      body.paymentIntentId || body.payment_intent_id || '',
    ).trim()
    if (!paymentIntentId) {
      return NextResponse.json(
        { success: false, error: 'Missing paymentIntentId.' },
        { status: 400 },
      )
    }

    const result = await confirmRentalPayment({
      paymentIntentId,
      stripeMode,
      paymentChannel,
      fallbackReservationRef: String(body.reservationRef || '').trim(),
      source: 'client',
      requireChannelMatch: true,
    })

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, data: result.data },
        { status: result.status },
      )
    }

    return NextResponse.json({
      success: true,
      reservationRef: result.reservationRef,
      paymentIntentId: result.paymentIntentId,
      chargeId: result.chargeId,
      paymentMethodType: result.paymentMethodType,
      paymentMethodBrand: result.paymentMethodBrand,
      stripeMode: result.stripeMode,
      paymentChannel: result.paymentChannel,
      rcmRebillingToken: result.rcmRebillingToken,
      data: result.data,
    })
  } catch (err: any) {
    console.error('[stripe rental confirm] error:', err.message)
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to confirm Stripe payment.',
      },
      { status: 500 },
    )
  }
}
