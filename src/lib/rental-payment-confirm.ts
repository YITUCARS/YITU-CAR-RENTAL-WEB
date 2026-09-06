import { rcmCall, rcmSaveRebillingToken } from '@/lib/rcm'
import { notifyWebsitePaymentReceived } from '@/lib/rcm-telegram'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  asMoneyFromCents,
  formatRcmDate,
  normalizePaymentChannel,
  retrievePaymentIntent,
  upsertSavedPaymentMethod,
  type PaymentChannel,
  type StripeMode,
} from '@/lib/stripe-rental'

/**
 * Recording a successful Stripe payment against the supplier's booking.
 *
 * Two callers reach this: the browser, once Stripe returns it to the callback
 * page, and the webhook, which fires whether or not the browser is still open.
 * The webhook is the one that matters — a customer who closes the tab after
 * paying would otherwise be charged while the booking goes unpaid and gets
 * auto-cancelled.
 *
 * Because both callers usually fire for the same payment, the RCM call is
 * claimed first: whoever inserts the payment intent id wins and confirms, and
 * the other returns early. RCM records a second payment if asked twice.
 */
export type ConfirmSource = 'client' | 'webhook'

export type ConfirmResult =
  | {
      ok: true
      alreadyConfirmed: boolean
      reservationRef: string
      paymentIntentId: string
      chargeId: string
      paymentMethodType: string
      paymentMethodBrand: string
      stripeMode: StripeMode
      paymentChannel: PaymentChannel
      rcmRebillingToken: any
      data: any
    }
  | { ok: false; status: number; error: string; data?: any }

/**
 * Reserves the right to confirm this payment.
 *
 * Returns 'claimed' for the caller that should talk to RCM, 'already' for one
 * arriving second, and 'unavailable' when the ledger cannot be reached — in
 * which case the caller proceeds anyway. Failing open matters: the table is
 * created separately, and blocking every confirmation until it exists would be
 * far worse than the duplicate this guards against.
 */
async function claimConfirmation(row: {
  paymentIntentId: string
  reservationRef: string
  amount: number
  paymentChannel: PaymentChannel
  stripeMode: StripeMode
  source: ConfirmSource
}): Promise<'claimed' | 'already' | 'unavailable'> {
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('rental_payment_confirmation').insert({
      payment_intent_id: row.paymentIntentId,
      reservation_ref: row.reservationRef,
      amount: row.amount,
      payment_channel: row.paymentChannel,
      stripe_mode: row.stripeMode,
      confirmed_by: row.source,
    })
    if (!error) return 'claimed'
    // 23505 is Postgres' unique violation: someone else got here first.
    if ((error as any)?.code === '23505') return 'already'
    console.warn(
      '[rental payment confirm] could not reach the confirmation ledger:',
      error.message,
    )
    return 'unavailable'
  } catch (error) {
    console.warn(
      '[rental payment confirm] could not reach the confirmation ledger:',
      error instanceof Error ? error.message : error,
    )
    return 'unavailable'
  }
}

/** Gives the claim back so a later attempt can retry a failed confirmation. */
async function releaseConfirmation(paymentIntentId: string) {
  try {
    const supabase = getSupabaseAdmin()
    await supabase
      .from('rental_payment_confirmation')
      .delete()
      .eq('payment_intent_id', paymentIntentId)
  } catch (error) {
    console.warn(
      '[rental payment confirm] could not release the claim:',
      error instanceof Error ? error.message : error,
    )
  }
}

export async function confirmRentalPayment(input: {
  paymentIntentId: string
  stripeMode: StripeMode
  paymentChannel: PaymentChannel
  fallbackReservationRef?: string
  source: ConfirmSource
  /**
   * Require the intent to have been created under `paymentChannel`, so a web
   * caller cannot confirm an app payment or the reverse. The webhook reads the
   * channel off the intent itself, so it has nothing to cross-check.
   */
  requireChannelMatch?: boolean
}): Promise<ConfirmResult> {
  const { paymentIntentId, stripeMode, paymentChannel, source } = input

  const pi = await retrievePaymentIntent(
    paymentIntentId,
    stripeMode,
    paymentChannel,
  )

  if (input.requireChannelMatch) {
    const intentChannel = normalizePaymentChannel(
      pi.metadata?.payment_channel || pi.metadata?.source,
    )
    if (intentChannel !== paymentChannel) {
      return {
        ok: false,
        status: 400,
        error: 'Stripe payment channel mismatch.',
      }
    }
  }

  if (pi.status !== 'succeeded') {
    return {
      ok: false,
      status: 400,
      error: `Stripe payment is ${pi.status}.`,
    }
  }

  const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null
  const paymentMethod =
    typeof pi.payment_method === 'object' ? pi.payment_method : null
  const paymentMethodType = String(
    charge?.payment_method_details?.type || '',
  ).toLowerCase()
  const card = charge?.payment_method_details?.card || paymentMethod?.card
  const billing = charge?.billing_details
  const reservationRef = String(
    pi.metadata?.rcm_reservation_ref || input.fallbackReservationRef || '',
  ).trim()
  if (!reservationRef) {
    return {
      ok: false,
      status: 400,
      error: 'Missing RCM reservation reference.',
    }
  }

  const amount = asMoneyFromCents(pi.amount_received || pi.amount)
  const chargeId =
    typeof pi.latest_charge === 'string' ? pi.latest_charge : charge?.id || ''
  const brand = String(
    card?.brand || charge?.payment_method_details?.type || 'STRIPE',
  ).toUpperCase()
  const last4 = String(card?.last4 || '')
  const expMonth = card?.exp_month ? String(card.exp_month).padStart(2, '0') : ''
  const expYear = card?.exp_year ? String(card.exp_year).slice(-2) : ''
  const supplierId = Number(process.env.RCM_STRIPE_SUPPLIER_ID || 5)

  const claim = await claimConfirmation({
    paymentIntentId: pi.id,
    reservationRef,
    amount,
    paymentChannel,
    stripeMode,
    source,
  })
  if (claim === 'already') {
    console.log('[rental payment confirm] already confirmed', {
      paymentIntentId: pi.id,
      reservationRef,
      source,
    })
    return {
      ok: true,
      alreadyConfirmed: true,
      reservationRef,
      paymentIntentId: pi.id,
      chargeId,
      paymentMethodType,
      paymentMethodBrand: card?.brand || '',
      stripeMode,
      paymentChannel,
      rcmRebillingToken: null,
      data: null,
    }
  }

  let rcmResult: any
  try {
    rcmResult = await rcmCall('confirmpayment', {
      reservationref: reservationRef,
      amount,
      success: true,
      paytype: brand,
      paydate: formatRcmDate(),
      supplierid: supplierId,
      transactid: pi.id,
      dpstxnref: chargeId,
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
  } catch (error) {
    if (claim === 'claimed') await releaseConfirmation(pi.id)
    throw error
  }

  if (rcmResult?.paymentsaved !== true) {
    if (claim === 'claimed') await releaseConfirmation(pi.id)
    return {
      ok: false,
      status: 502,
      error: 'RCM did not confirm payment.',
      data: rcmResult,
    }
  }

  let rcmRebillingTokenResult: any = null
  const stripePaymentMethodId = String(
    typeof pi.payment_method === 'string'
      ? pi.payment_method
      : pi.payment_method?.id || '',
  )
  const stripeCustomerId = String(
    typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || '',
  )
  const reusableCard = Boolean(
    stripeCustomerId && stripePaymentMethodId && paymentMethodType === 'card',
  )

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
        '[rental payment confirm] RCM rebilling token save failed:',
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
    latest_charge_id: chargeId,
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
      source: source === 'webhook' ? 'stripe_webhook' : 'confirm_payment',
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
      chargeId,
      paymentMethod: paymentMethodType || brand,
      paymentChannel,
    })
  } catch (error) {
    console.error(
      '[rental payment confirm] Telegram payment notification failed:',
      error instanceof Error ? error.message : error,
    )
  }

  return {
    ok: true,
    alreadyConfirmed: false,
    reservationRef,
    paymentIntentId: pi.id,
    chargeId,
    paymentMethodType,
    paymentMethodBrand: card?.brand || '',
    stripeMode,
    paymentChannel,
    rcmRebillingToken: rcmRebillingTokenResult,
    data: rcmResult,
  }
}
