export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

export async function POST(req: NextRequest) {
    try {
        const { reservationRef, amount, payScenario } = await req.json()

        // Build an absolute base URL so the payment gateway can redirect back to us.
        // x-forwarded-host / x-forwarded-proto are set by Vercel / reverse proxies.
        const host =
            req.headers.get('x-forwarded-host') ||
            req.headers.get('host') ||
            'localhost:3000'
        const proto =
            req.headers.get('x-forwarded-proto') ||
            (host.startsWith('localhost') ? 'http' : 'https')
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`

        // Include reservationRef in the callback URL so the callback page can
        // always retrieve it, even if sessionStorage was cleared or not synced.
        const successUrl = `${baseUrl}/booking/payment/callback?reservationRef=${encodeURIComponent(reservationRef)}`
        const failUrl    = `${baseUrl}/booking/payment/callback?success=false&reservationRef=${encodeURIComponent(reservationRef)}`

        const result = await rcmCall('createpaymenttransaction', {
            paymentgatewaytype: 'VostroPay',
            reservationref: reservationRef,
            transactiontype: 'payment',
            amount: amount,
            payscenario: payScenario ?? 1,
            paysource: 'YITU Web Booking',
            emailoption: 1,
            successurl: successUrl,
            failurl: failUrl,
        })

        return NextResponse.json({ success: true, data: result })
    } catch (err: any) {
        console.error('create-payment error:', err.message)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
