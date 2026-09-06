export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { confirmRentalPayment } from '@/lib/rental-payment-confirm'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { verifyStripeSignature } from '@/lib/stripe-webhook'
import { normalizePaymentChannel, normalizeStripeMode } from '@/lib/stripe-rental'

/**
 * Stripe's own account of what was paid.
 *
 * This is the safety net behind the browser: the confirm route only runs if
 * the customer is still on the callback page, so a closed tab used to mean a
 * charged card and a booking the supplier never heard about, which then got
 * auto-cancelled for non-payment.
 *
 * Fails closed. Without a signing secret nothing is trusted, because an
 * unverified endpoint that marks bookings paid is the hole this whole change
 * set started by removing.
 */
/**
 * Every signing secret that could legitimately have signed this event.
 *
 * Rental payments are split across two Stripe accounts — the website charges
 * through YITU's, the app through Vantu's — so each has its own endpoint and
 * its own secret. Which account sent an event is not knowable before the
 * signature is checked, and the unverified body must not be the thing that
 * decides, so every secret configured for this mode is tried and one match is
 * enough. A secret cannot verify an event it did not sign, so trying several
 * costs nothing in strength.
 */
function candidateSecrets(livemode: boolean): string[] {
  const names = livemode
    ? ['STRIPE_WEBHOOK_SECRET', 'VANTU_STRIPE_WEBHOOK_SECRET']
    : [
        'STRIPE_WEBHOOK_SECRET_TEST',
        'VANTU_STRIPE_WEBHOOK_SECRET_TEST',
        'STRIPE_WEBHOOK_SECRET',
        'VANTU_STRIPE_WEBHOOK_SECRET',
      ]
  const seen: string[] = []
  for (const name of names) {
    const value = process.env[name]
    if (value && !seen.includes(value)) seen.push(value)
  }
  return seen
}

async function recordEvent(event: any, handled: boolean, error?: string) {
  try {
    const supabase = getSupabaseAdmin()
    await supabase.from('stripe_webhook_event').upsert(
      {
        event_id: event?.id,
        type: event?.type || '',
        payment_intent_id: event?.data?.object?.id || null,
        livemode: Boolean(event?.livemode),
        handled,
        error: error || null,
      },
      { onConflict: 'event_id' },
    )
  } catch (err) {
    console.warn(
      '[stripe webhook] could not record the event:',
      err instanceof Error ? err.message : err,
    )
  }
}

export async function POST(req: NextRequest) {
  // Must be the bytes as received — parsing and re-serialising breaks the HMAC.
  const rawBody = await req.text()

  let parsed: any
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Malformed body.' }, { status: 400 })
  }

  const secrets = candidateSecrets(Boolean(parsed?.livemode))
  if (secrets.length === 0) {
    console.error(
      '[stripe webhook] refused: no signing secret configured for this mode',
      { livemode: Boolean(parsed?.livemode) },
    )
    return NextResponse.json(
      { error: 'Webhook signing secret is not configured.' },
      { status: 500 },
    )
  }

  const header = req.headers.get('stripe-signature')
  let lastReason = 'signature mismatch'
  const verified = secrets.some((secret) => {
    const check = verifyStripeSignature({ rawBody, header, secret })
    if (!check.ok) lastReason = check.reason
    return check.ok
  })
  if (!verified) {
    console.warn('[stripe webhook] rejected:', lastReason)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  const event = parsed
  if (event?.type !== 'payment_intent.succeeded') {
    // Acknowledged so Stripe stops retrying something we do not act on.
    await recordEvent(event, false, 'event type not handled')
    return NextResponse.json({ received: true, handled: false })
  }

  const pi = event?.data?.object
  const paymentIntentId = String(pi?.id || '')
  if (!paymentIntentId) {
    await recordEvent(event, false, 'no payment intent id')
    return NextResponse.json({ received: true, handled: false })
  }

  const stripeMode = normalizeStripeMode(event?.livemode ? 'live' : 'test')
  const paymentChannel = normalizePaymentChannel(
    pi?.metadata?.payment_channel || pi?.metadata?.source,
  )
  const reservationRef = String(pi?.metadata?.rcm_reservation_ref || '').trim()

  // Payments for anything other than a rental booking pass through untouched.
  if (!reservationRef) {
    await recordEvent(event, false, 'no rcm_reservation_ref in metadata')
    return NextResponse.json({ received: true, handled: false })
  }

  try {
    const result = await confirmRentalPayment({
      paymentIntentId,
      stripeMode,
      paymentChannel,
      fallbackReservationRef: reservationRef,
      source: 'webhook',
    })

    if (!result.ok) {
      await recordEvent(event, false, result.error)
      // 5xx asks Stripe to retry; a booking it will not accept payment for is
      // worth retrying, since the supplier may simply have been unreachable.
      console.error('[stripe webhook] confirmation failed:', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    await recordEvent(event, true)
    console.log('[stripe webhook] confirmed', {
      paymentIntentId,
      reservationRef: result.reservationRef,
      alreadyConfirmed: result.alreadyConfirmed,
    })
    return NextResponse.json({
      received: true,
      handled: true,
      alreadyConfirmed: result.alreadyConfirmed,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await recordEvent(event, false, message)
    console.error('[stripe webhook] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
