export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

function getStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY.')
  return key
}

function cents(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid payment amount.')
  }
  return Math.round(amount)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const amount = cents(body.amountCents ?? body.amount)
    const reservationRef = String(body.reservationRef || '').trim()
    if (!reservationRef) {
      return NextResponse.json(
        { success: false, error: 'Missing reservationRef.' },
        { status: 400 },
      )
    }

    const params = new URLSearchParams()
    params.set('amount', String(amount))
    params.set('currency', String(body.currency || 'nzd').toLowerCase())
    params.set('description', body.description || `YITU rental ${reservationRef}`)
    params.set('metadata[rcm_reservation_ref]', reservationRef)
    params.set('metadata[source]', 'yitu_car_rental_app')
    params.set('automatic_payment_methods[enabled]', 'true')
    const email = String(body.email || '').trim()
    if (email) params.set('receipt_email', email)

    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getStripeSecretKey()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })

    const data = await stripeRes.json()
    if (!stripeRes.ok) {
      return NextResponse.json(
        { success: false, error: data?.error?.message || 'Stripe create intent failed.' },
        { status: stripeRes.status },
      )
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      clientSecret: data.client_secret,
      status: data.status,
    })
  } catch (err: any) {
    console.error('[stripe rental create-intent] error:', err.message)
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create payment intent.' },
      { status: 500 },
    )
  }
}
