export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall, rcmSaveRebillingToken } from '@/lib/rcm'
import { notifyWebsitePaymentReceived } from '@/lib/rcm-telegram'
import {
  asMoneyFromCents,
  formatRcmDate,
  normalizePaymentChannel,
  normalizeStripeMode,
  retrievePaymentIntent,
  upsertSavedPaymentMethod,
} from '@/lib/stripe-rental'

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
    const paymentMethod = typeof pi.payment_method === 'object' ? pi.payment_method : null
    const paymentMethodType = String(
      charge?.payment_method_details?.type || '',
    ).toLowerCase()
    const card = charge?.payment_method_details?.card || paymentMethod?.card
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

    let rcmRebillingTokenResult: any = null
    const stripePaymentMethodId = String(
      typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id || '',
    )
    const stripeCustomerId = String(
      typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || '',
    )
    const reusableCard = Boolean(stripeCustomerId && stripePaymentMethodId && paymentMethodType === 'card')

    if (reusableCard) {
      try {
        rcmRebillingTokenResult = await rcmSaveRebillingToken({
          reservationRef,
          rebillingToken: stripeCustomerId,
          cardHolder: billing?.name || '',
          cardNumber: last4,
          cardExpiry: expMonth && expYear ? `${expMonth}/${expYear}` : '',
          payType: 'Credit Card',
          paySource:
            paymentChannel === 'vantu_app'
              ? 'Stripe via Vantu App'
              : 'Stripe via YituCarRental Web',
        })
      } catch (error) {
        rcmRebillingTokenResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
        console.error(
          '[stripe rental confirm] RCM rebilling token save failed:',
          rcmRebillingTokenResult.error,
        )
      }
    }

    await upsertSavedPaymentMethod({
      reservation_ref: reservationRef,
      payment_channel: paymentChannel,
      stripe_mode: stripeMode,
      stripe_customer_id: stripeCustomerId,
      stripe_payment_method_id: stripePaymentMethodId,
      latest_payment_intent_id: pi.id,
      latest_charge_id:
        typeof pi.latest_charge === 'string' ? pi.latest_charge : charge?.id || '',
      customer_email: billing?.email || '',
      customer_name: billing?.name || '',
      customer_phone: billing?.phone || '',
      payment_method_type: paymentMethodType,
      card_brand: String(card?.brand || ''),
      card_last4: String(card?.last4 || ''),
      card_exp_month: card?.exp_month || null,
      card_exp_year: card?.exp_year || null,
      reusable: reusableCard,
      last_payment_amount: amount,
      last_payment_at: new Date().toISOString(),
      metadata: {
        source: 'confirm_payment',
        rcm_confirmed: true,
        rcm_rebilling_token: rcmRebillingTokenResult,
        setup_future_usage: pi.setup_future_usage || '',
      },
    })

    try {
      await notifyWebsitePaymentReceived({
        reservationRef,
        amount,
        paymentIntentId: pi.id,
        chargeId:
          typeof pi.latest_charge === 'string' ? pi.latest_charge : charge?.id || '',
        paymentMethod: paymentMethodType || brand,
        paymentChannel,
      })
    } catch (error) {
      console.error(
        '[stripe rental confirm] Telegram payment notification failed:',
        error instanceof Error ? error.message : error,
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
      rcmRebillingToken: rcmRebillingTokenResult,
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
