export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getWechatPayConfig, wechatPayGet } from '@/lib/wechat-pay'
import { settleTicketTransaction, ticketAttach } from '@/lib/vantu-tickets'

// After wx.requestPayment: checks the payment with WeChat and has Vantu
// issue the ticket, without waiting for WeChat's notification. Both paths
// may run; Vantu issues each order once.
export async function POST(req: NextRequest) {
    try {
        const cfg = getWechatPayConfig()
        const body = await req.json().catch(() => ({}))
        const orderId = String(body.orderId || '').trim()
        const outTradeNo = String(body.outTradeNo || '').trim()
        if (!orderId || !outTradeNo) return NextResponse.json({ error: 'Missing orderId or outTradeNo' }, { status: 400 })

        const transaction = await wechatPayGet(
            `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(cfg.mchid)}`,
        )
        if (ticketAttach(transaction)?.orderId !== orderId) {
            return NextResponse.json({ error: 'Payment does not match this order.' }, { status: 403 })
        }
        if (transaction.trade_state !== 'SUCCESS') {
            return NextResponse.json({ paid: false, tradeState: transaction.trade_state || 'UNKNOWN' })
        }
        try {
            const result = await settleTicketTransaction(transaction)
            return NextResponse.json({ paid: true, status: result.status })
        } catch (err: any) {
            // Paid, but the ticket is not out yet; WeChat's notification retries it.
            return NextResponse.json({ paid: true, status: 'issue_failed', error: err.message })
        }
    } catch (err: any) {
        console.error('[wx/ticket-pay/confirm] error:', err.message)
        return NextResponse.json({ error: err.message || '查询支付失败' }, { status: 500 })
    }
}
