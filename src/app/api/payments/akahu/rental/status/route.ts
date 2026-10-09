export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { confirmAkahuRentalPayment, getAkahuRentalPayment, isAkahuPaymentTerminal } from '@/lib/akahu-rental'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const paymentId = String(body.akahuPaymentId || body.paymentId || '').trim()
    const reservationRef = String(body.reservationRef || '').trim()
    const expectedAmount = Math.round(Number(body.amount) * 100) / 100
    if (!paymentId || !reservationRef || !Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Missing Akahu payment details.' }, { status: 400 })
    }
    const payment = await getAkahuRentalPayment(paymentId)
    const result = await confirmAkahuRentalPayment({ payment, reservationRef, expectedAmount, source: 'poll' })
    if (result.ok) return NextResponse.json({ success: true, paid: true, status: payment.status, alreadyConfirmed: result.alreadyConfirmed })
    return NextResponse.json({
      success: true,
      paid: false,
      terminal: isAkahuPaymentTerminal(payment),
      status: payment.status,
      statusCode: payment.status_code || '',
      error: 'error' in result ? result.error : '',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check Akahu payment.'
    console.error('[akahu rental status] error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
