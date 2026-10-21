export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { buildMiniProgramPayment, getWechatPayConfig, wechatPayPost } from '@/lib/wechat-pay'
import { fetchTicketOrder, getNzdCnyRate, openidFromLoginCode, TICKET_ATTACH_KIND } from '@/lib/vantu-tickets'

function makeOutTradeNo() {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
    return `YTKT${Date.now()}${suffix}`.slice(0, 32)
}

// Creates the WeChat Pay transaction for a Vantu ticket order. The amount is
// always read from Vantu, never taken from the mini program.
export async function POST(req: NextRequest) {
    try {
        const cfg = getWechatPayConfig()
        const body = await req.json().catch(() => ({}))
        const orderId = String(body.orderId || '').trim()
        if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
        const openid = await openidFromLoginCode(String(body.code || ''))
        if (!openid) return NextResponse.json({ error: '微信登录失败，请重试' }, { status: 401 })

        const order = await fetchTicketOrder(orderId)
        if (!order) return NextResponse.json({ error: '订单不存在' }, { status: 404 })
        if (order.status !== 'pending_payment' && order.status !== 'issue_failed') {
            return NextResponse.json({ error: '该订单已支付或已处理', status: order.status }, { status: 409 })
        }
        if (String(order.currency).toLowerCase() !== 'nzd' || order.amountCents < 50) {
            return NextResponse.json({ error: '订单金额无效' }, { status: 400 })
        }

        const rate = await getNzdCnyRate()
        const amountFen = Math.max(1, Math.round((order.amountCents / 100) * rate * 100))
        const outTradeNo = makeOutTradeNo()
        const payload = {
            appid: cfg.appid,
            mchid: cfg.mchid,
            description: `门票 ${order.activityName}`.slice(0, 127),
            out_trade_no: outTradeNo,
            notify_url: cfg.notifyUrl,
            amount: { total: amountFen, currency: 'CNY' },
            payer: { openid },
            attach: JSON.stringify({ k: TICKET_ATTACH_KIND, o: order.id, c: order.amountCents }),
        }
        const result = await wechatPayPost('/v3/pay/transactions/jsapi', payload)
        if (!result.prepay_id) throw new Error('WeChat Pay did not return prepay_id')

        return NextResponse.json({
            outTradeNo,
            amountCny: (amountFen / 100).toFixed(2),
            rate: rate.toFixed(4),
            payment: buildMiniProgramPayment(result.prepay_id),
        })
    } catch (err: any) {
        console.error('[wx/ticket-pay/create] error:', err.message)
        return NextResponse.json({ error: err.message || '创建支付失败' }, { status: 500 })
    }
}
