export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'
import {
  asMoneyFromCents,
  cents,
  formatRcmDate,
  getSavedPaymentMethod,
  normalizePaymentChannel,
  normalizeStripeMode,
  stripeRequest,
  upsertSavedPaymentMethod,
} from '@/lib/stripe-rental'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const reservationRef = String(body.reservationRef || '').trim()
    if (!reservationRef) {
      return NextResponse.json(
        { success: false, error: 'Missing reservationRef.' },
        { status: 400 },
      )
    }

    const amount = cents(body.amountCents ?? body.amount)
    const saved = await getSavedPaymentMethod(reservationRef)
    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'No saved Stripe payment method for this booking.' },
        { status: 404 },
      )
    }
    if (!saved.reusable || !saved.stripe_customer_id || !saved.stripe_payment_method_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This booking does not have a reusable saved card. Ask the customer to pay again.',
        },
        { status: 409 },
      )
    }

    const stripeMode = normalizeStripeMode(body.stripeMode || saved.stripe_mode)
    const paymentChannel = normalizePaymentChannel(body.paymentChannel || saved.payment_channel)
    const params = new URLSearchParams()
    params.set('amount', String(amount))
    params.set('currency', String(body.currency || 'nzd').toLowerCase())
    params.set('customer', saved.stripe_customer_id)
    params.set('payment_method', saved.stripe_payment_method_id)
    params.set('confirm', 'true')
    params.set('off_session', 'true')
    params.set(
      'description',
      String(body.description || `YITU rental ${reservationRef} additional charge`),
    )
    params.set('metadata[rcm_reservation_ref]', reservationRef)
    params.set('metadata[source]', paymentChannel)
    params.set('metadata[payment_channel]', paymentChannel)
    params.set('metadata[stripe_mode]', stripeMode)
    params.set('metadata[charge_type]', 'off_session_admin')

    const intent = await stripeRequest('payment_intents', params, stripeMode, paymentChannel)
    if (intent.status !== 'succeeded') {
      return NextResponse.json(
        {
          success: false,
          error: `Stripe off-session charge is ${intent.status}.`,
          data: intent,
        },
        { status: 402 },
      )
    }

    const chargeId =
      typeof intent.latest_charge === 'string'
        ? intent.latest_charge
        : intent.latest_charge?.id || ''
    const supplierId = Number(process.env.RCM_STRIPE_SUPPLIER_ID || 5)
    const nzdAmount = asMoneyFromCents(intent.amount_received || intent.amount)
    const rcmResult = await rcmCall('confirmpayment', {
      reservationref: reservationRef,
      amount: nzdAmount,
      success: true,
      paytype: String(saved.card_brand || saved.payment_method_type || 'STRIPE').toUpperCase(),
      paydate: formatRcmDate(),
      supplierid: supplierId,
      transactid: intent.id,
      dpstxnref: chargeId,
      cardholder: saved.customer_name || '',
      paysource: 'Stripe saved card via YituCarRental Admin',
      cardnumber: saved.card_last4 ? `############${saved.card_last4}` : '',
      cardexpiry:
        saved.card_exp_month && saved.card_exp_year
          ? `${String(saved.card_exp_month).padStart(2, '0')}/${String(saved.card_exp_year).slice(-2)}`
          : '',
      transtype: 'Payment',
      emailoption: 1,
    })

    await upsertSavedPaymentMethod({
      reservation_ref: reservationRef,
      reservation_no: saved.reservation_no || '',
      payment_channel: paymentChannel,
      stripe_mode: stripeMode,
      stripe_customer_id: saved.stripe_customer_id,
      stripe_payment_method_id: saved.stripe_payment_method_id,
      latest_payment_intent_id: intent.id,
      latest_charge_id: chargeId,
      customer_email: saved.customer_email || '',
      customer_name: saved.customer_name || '',
      customer_phone: saved.customer_phone || '',
      payment_method_type: saved.payment_method_type || '',
      card_brand: saved.card_brand || '',
      card_last4: saved.card_last4 || '',
      card_exp_month: saved.card_exp_month || null,
      card_exp_year: saved.card_exp_year || null,
      reusable: true,
      last_payment_amount: nzdAmount,
      last_payment_at: new Date().toISOString(),
      metadata: {
        source: 'admin_off_session_charge',
        rcm_confirmed: rcmResult?.paymentsaved === true,
      },
    })

    return NextResponse.json({
      success: true,
      reservationRef,
      amount: nzdAmount,
      paymentIntentId: intent.id,
      chargeId,
      rcm: rcmResult,
    })
  } catch (err: any) {
    console.error('[admin stripe off-session charge] error:', err.message)
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Unable to charge saved payment method.',
        stripeError: err.stripeError
          ? {
              type: err.stripeError.type || '',
              code: err.stripeError.code || '',
              param: err.stripeError.param || '',
            }
          : undefined,
      },
      { status: err.status || 500 },
    )
  }
}
