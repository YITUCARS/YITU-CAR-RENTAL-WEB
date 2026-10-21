export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchTicketOrder, getNzdCnyRate, maskEmail } from '@/lib/vantu-tickets'

// Mini program ticket payment page: the Vantu ticket order to pay.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}))
        const orderId = String(body.orderId || '').trim()
        if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
        const order = await fetchTicketOrder(orderId)
        if (!order) return NextResponse.json({ error: '订单不存在' }, { status: 404 })
        const rate = await getNzdCnyRate()
        return NextResponse.json({
            order: { ...order, customerEmail: maskEmail(order.customerEmail) },
            rate: rate.toFixed(4),
            amountCny: ((order.amountCents / 100) * rate).toFixed(2),
        })
    } catch (err: any) {
        console.error('[wx/ticket-pay/order] error:', err.message)
        return NextResponse.json({ error: err.message || '读取订单失败' }, { status: 500 })
    }
}
