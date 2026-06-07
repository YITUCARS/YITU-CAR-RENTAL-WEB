export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

function normalizeStripeMode(value: unknown) {
  const mode = String(value || '').toLowerCase()
  return mode === 'live' || mode === 'production' ? 'live' : 'test'
}

function normalizePaymentChannel(value: unknown) {
  return String(value || '').toLowerCase() === 'vantu_app'
    ? 'vantu_app'
    : 'yitu_web'
}

function getStripeSecretKey(mode: string, channel: string) {
  if (channel === 'vantu_app') {
    const key =
      mode === 'live'
        ? process.env.VANTU_STRIPE_LIVE_SECRET_KEY
        : process.env.VANTU_STRIPE_TEST_SECRET_KEY
    if (!key) {
      throw new Error(
        mode === 'live'
          ? 'Missing VANTU_STRIPE_LIVE_SECRET_KEY.'
          : 'Missing VANTU_STRIPE_TEST_SECRET_KEY.',
      )
    }
    return key
  }
  const key =
    mode === 'live'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      mode === 'live'
        ? 'Missing STRIPE_LIVE_SECRET_KEY.'
        : 'Missing STRIPE_TEST_SECRET_KEY.',
    )
  }
  return key
}

function formatRcmDate(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function asMoneyFromCents(value: unknown) {
  const cents = Number(value)
  if (!Number.isFinite(cents) || cents <= 0) return 0
  return Math.round(cents) / 100
}

async function retrievePaymentIntent(
  paymentIntentId: string,
  stripeMode: string,
  paymentChannel: string,
) {
  const params = new URLSearchParams()
  params.append('expand[]', 'latest_charge')
  const stripeRes = await fetch(
    `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${getStripeSecretKey(stripeMode, paymentChannel)}`,
      },
    },
  )
  const data = await stripeRes.json()
  if (!stripeRes.ok) {
    throw new Error(data?.error?.message || 'Unable to retrieve Stripe payment.')
  }
  return data
}

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

    const pi = await retrievePaymentIntent(
      paymentIntentId,
      stripeMode,
      paymentChannel,
    )
    const intentChannel = normalizePaymentChannel(
      pi.metadata?.payment_channel || pi.metadata?.source,
    )
    if (intentChannel !== paymentChannel) {
      return NextResponse.json(
        { success: false, error: 'Stripe payment channel mismatch.' },
        { status: 400 },
      )
    }
    if (pi.status !== 'succeeded') {
      return NextResponse.json(
        { success: false, error: `Stripe payment is ${pi.status}.` },
        { status: 400 },
      )
    }

    const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null
    const paymentMethodType = String(
      charge?.payment_method_details?.type || '',
    ).toLowerCase()
    const card = charge?.payment_method_details?.card
    const billing = charge?.billing_details
    const reservationRef = String(
      pi.metadata?.rcm_reservation_ref || body.reservationRef || '',
    ).trim()
    if (!reservationRef) throw new Error('Missing RCM reservation reference.')

    const amount = asMoneyFromCents(pi.amount_received || pi.amount)
    const brand = String(
      card?.brand || charge?.payment_method_details?.type || 'STRIPE',
    ).toUpperCase()
    const last4 = String(card?.last4 || '')
    const expMonth = card?.exp_month
      ? String(card.exp_month).padStart(2, '0')
      : ''
    const expYear = card?.exp_year ? String(card.exp_year).slice(-2) : ''
    const supplierId = Number(process.env.RCM_STRIPE_SUPPLIER_ID || 5)

    const rcmResult = await rcmCall('confirmpayment', {
      reservationref: reservationRef,
      amount,
      success: true,
      paytype: brand,
      paydate: formatRcmDate(),
      supplierid: supplierId,
      transactid: pi.id,
      dpstxnref:
        typeof pi.latest_charge === 'string' ? pi.latest_charge : charge?.id || '',
      cardholder: billing?.name || '',
      paysource:
        paymentChannel === 'vantu_app'
          ? 'Stripe via Vantu App'
          : 'Stripe via YituCarRental Web',
      cardnumber: last4 ? `############${last4}` : '',
      cardexpiry: expMonth && expYear ? `${expMonth}/${expYear}` : '',
      transtype: 'Payment',
      emailoption: 1,
    })

    if (rcmResult?.paymentsaved !== true) {
      return NextResponse.json(
        {
          success: false,
          error: 'RCM did not confirm payment.',
          data: rcmResult,
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      reservationRef,
      paymentIntentId: pi.id,
      chargeId:
        typeof pi.latest_charge === 'string' ? pi.latest_charge : charge?.id || '',
      paymentMethodType,
      paymentMethodBrand: card?.brand || '',
      stripeMode,
      paymentChannel,
      data: rcmResult,
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
