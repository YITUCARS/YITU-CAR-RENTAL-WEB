import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

export async function POST(req: NextRequest) {
    try {
        const {
            reservationRef, amount, success,
            payType, payDate, supplierId,
            transactId, dpsTxnRef, cardHolder,
        } = await req.json()

        const result = await rcmCall('confirmpayment', {
            reservationref: reservationRef,
            amount: amount,
            success: success,
            paytype: payType ?? 'VostroPay',
            paydate: payDate,
            supplierid: supplierId,
            transactid: transactId ?? '',
            dpstxnref: dpsTxnRef ?? '',
            cardholder: cardHolder ?? '',
            paysource: 'YITU Web Booking',
            payscenario: 1,
            emailoption: 1,
        })

        return NextResponse.json({ success: true, data: result })
    } catch (err: any) {
        console.error('confirm-payment error:', err.message)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}