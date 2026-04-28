export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

function pickBookingInfo(info: any) {
  return info?.bookinginfo?.[0] || info || {}
}

function pickPaymentInfo(info: any) {
  return info?.paymentinfo?.[0] || {}
}

function toAmount(value: any): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function POST(req: NextRequest) {
  try {
    const { reservationRef, expectedAmount } = await req.json()

    if (!reservationRef) {
      return NextResponse.json({ success: false, error: 'Missing reservationRef' }, { status: 400 })
    }

    const info = await rcmCall('bookinginfo', { reservationref: String(reservationRef).trim() })
    const booking = pickBookingInfo(info)
    const payment = pickPaymentInfo(info)
    const paidAmount = toAmount(payment.paidamount ?? booking.payment ?? booking.paidamount)
    const requiredAmount = Math.max(0, toAmount(expectedAmount))

    return NextResponse.json({
      success: true,
      paid: requiredAmount > 0 ? paidAmount + 0.001 >= requiredAmount : paidAmount > 0,
      paidAmount,
      expectedAmount: requiredAmount,
      reservationRef,
      booking
    })
  } catch (err: any) {
    console.error('payment-status error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
