export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { confirmAkahuRentalPayment, getAkahuRentalPayment, verifyAkahuWebhook } from '@/lib/akahu-rental'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!(await verifyAkahuWebhook(rawBody, req.headers))) {
    return NextResponse.json({ error: 'Invalid Akahu webhook signature.' }, { status: 400 })
  }
  try {
    const event = JSON.parse(rawBody)
    const paymentId = String(event?._id || event?.payment?._id || event?.payment_id || '').trim()
    if (!paymentId) return NextResponse.json({ received: true, handled: false })
    // Fetch the complete payment from Akahu; webhook data itself is never used
    // as the source of truth for the amount or recipient.
    const payment = await getAkahuRentalPayment(paymentId)
    const reservationRef = String(payment.payee?.reference || '').trim()
    if (!reservationRef || String(payment.status).toUpperCase() !== 'SENT') {
      return NextResponse.json({ received: true, handled: false })
    }
    const result = await confirmAkahuRentalPayment({
      payment,
      reservationRef,
      expectedAmount: Number(payment.amount),
      source: 'webhook',
    })
    if (!result.ok) return NextResponse.json({ error: result.error || 'Akahu payment was not confirmed.' }, { status: 500 })
    return NextResponse.json({ received: true, handled: true, alreadyConfirmed: result.alreadyConfirmed })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Akahu webhook processing failed.'
    console.error('[akahu rental webhook] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
