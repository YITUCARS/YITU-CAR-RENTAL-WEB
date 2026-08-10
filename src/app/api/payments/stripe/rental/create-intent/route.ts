export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  cents,
  createStripeCustomer,
  getStripeSecretKey,
  normalizePaymentChannel,
  normalizeStripeMode,
  upsertSavedPaymentMethod,
} from '@/lib/stripe-rental'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const stripeMode = normalizeStripeMode(body.stripeMode || body.mode)
    const paymentChannel = normalizePaymentChannel(body.paymentChannel)
    const amount = cents(body.amountCents ?? body.amount)
    const reservationRef = String(body.reservationRef || '').trim()
    if (!reservationRef) {
      return NextResponse.json(
        { success: false, error: 'Missing reservationRef.' },
        { status: 400 },
      )
    }
    const customerEmail = String(body.customerEmail || body.email || '').trim().toLowerCase()
    const customerName = String(
      body.customerName ||
        [body.firstName, body.lastName].filter(Boolean).join(' ') ||
        '',
    ).trim()
    const customerPhone = String(body.customerPhone || body.phone || '').trim()

    const customer = await createStripeCustomer({
      stripeMode,
      paymentChannel,
      reservationRef,
      email: customerEmail,
      name: customerName,
      phone: customerPhone,
    })

    const params = new URLSearchParams()
    params.set('amount', String(amount))
    params.set('currency', String(body.currency || 'nzd').toLowerCase())
    params.set('customer', String(customer.id))
    params.set(
      'description',
      body.description || `YITU rental ${reservationRef}`,
    )
    params.set('metadata[rcm_reservation_ref]', reservationRef)
    params.set('metadata[source]', paymentChannel)
    params.set('metadata[payment_channel]', paymentChannel)
    params.set('metadata[stripe_mode]', stripeMode)
    // Explicitly enable card + Alipay so the Payment Element can surface Alipay
    // when it is enabled in Stripe for this account/currency.
    params.append('payment_method_types[]', 'card')
    params.append('payment_method_types[]', 'alipay')
    // Save reusable card credentials without applying setup_future_usage to
    // Alipay, which Stripe explicitly rejects for this payment method type.
    params.set('payment_method_options[card][setup_future_usage]', 'off_session')
    // Do not pass receipt_email here. App-entered emails can contain invisible
    // whitespace or be non-final customer contact data, and Stripe rejects the
    // whole PaymentIntent for an invalid receipt_email.

    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getStripeSecretKey(stripeMode, paymentChannel)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })

    const data = await stripeRes.json()
    if (!stripeRes.ok) {
      console.error(
        '[stripe rental create-intent] Stripe error:',
        JSON.stringify(data?.error || data),
      )
      return NextResponse.json(
        {
          success: false,
          error: data?.error?.message || 'Stripe create intent failed.',
          stripeError: {
            type: data?.error?.type || '',
            code: data?.error?.code || '',
            param: data?.error?.param || '',
          },
        },
        { status: stripeRes.status },
      )
    }

    await upsertSavedPaymentMethod({
      reservation_ref: reservationRef,
      reservation_no: String(body.reservationNo || ''),
      payment_channel: paymentChannel,
      stripe_mode: stripeMode,
      stripe_customer_id: String(customer.id),
      latest_payment_intent_id: String(data.id || ''),
      customer_email: customerEmail,
      customer_name: customerName,
      customer_phone: customerPhone,
      reusable: false,
      metadata: {
        source: 'create_intent',
        amount_cents: amount,
        currency: String(body.currency || 'nzd').toLowerCase(),
      },
    })

    return NextResponse.json({
      success: true,
      id: data.id,
      clientSecret: data.client_secret,
      status: data.status,
      stripeMode,
      paymentChannel,
      customerId: customer.id,
    })
  } catch (err: any) {
    console.error('[stripe rental create-intent] error:', err.message)
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to create payment intent.',
      },
      { status: 500 },
    )
  }
}
