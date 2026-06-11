export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildMiniProgramPayment, getWechatPayConfig, wechatPayPost } from '@/lib/wechat-pay'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function toAmount(value: any) {
  const n = Number(value || 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

async function getNzdCnyRate() {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=NZD&to=CNY', { cache: 'no-store' })
    const data = await res.json()
    const rate = Number(data?.rates?.CNY || 0)
    if (Number.isFinite(rate) && rate > 0) return rate
  } catch (err: any) {
    console.warn('[wx/pay/create] exchange-rate failed:', err.message)
  }
  return 4.3
}

function makeOutTradeNo() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `YITU${Date.now()}${suffix}`.slice(0, 32)
}

export async function POST(req: NextRequest) {
  try {
    const cfg = getWechatPayConfig()
    const body = await req.json()
    const openid = req.headers.get('x-openid') || body.openid || ''
    const reservationRef = String(body.reservationRef || '').trim()
    const reservationNo = String(body.reservationNo || '').trim()

    if (!openid) return NextResponse.json({ error: 'Missing openid' }, { status: 401 })
    if (!reservationRef) return NextResponse.json({ error: 'Missing reservationRef' }, { status: 400 })

    let depositNzd = toAmount(body.depositNzd)
    const supabase = getSupabase()
    if (supabase) {
      const { data } = await supabase
        .from('wx_user_bookings')
        .select('deposit')
        .eq('openid', openid)
        .eq('reservation_ref', reservationRef)
        .maybeSingle()
      if (data?.deposit) depositNzd = toAmount(data.deposit)
    }

    if (!depositNzd) return NextResponse.json({ error: 'Invalid deposit amount' }, { status: 400 })

    const rate = await getNzdCnyRate()
    const amountCny = depositNzd * rate
    const amountFen = Math.max(1, Math.round(amountCny * 100))
    const outTradeNo = makeOutTradeNo()
    const attach = JSON.stringify({ reservationRef, reservationNo, openid, depositNzd: depositNzd.toFixed(2) })

    const payload = {
      appid: cfg.appid,
      mchid: cfg.mchid,
      description: `YITU租车定金 ${reservationNo || reservationRef}`.slice(0, 127),
      out_trade_no: outTradeNo,
      notify_url: cfg.notifyUrl,
      amount: {
        total: amountFen,
        currency: 'CNY',
      },
      payer: { openid },
      attach,
    }

    const result = await wechatPayPost('/v3/pay/transactions/jsapi', payload)
    const prepayId = result.prepay_id
    if (!prepayId) throw new Error('WeChat Pay did not return prepay_id')

    return NextResponse.json({
      success: true,
      outTradeNo,
      amountFen,
      amountCny: (amountFen / 100).toFixed(2),
      rate: rate.toFixed(4),
      payment: buildMiniProgramPayment(prepayId),
    })
  } catch (err: any) {
    console.error('[wx/pay/create] error:', err.message)
    return NextResponse.json({ error: err.message || 'Failed to create WeChat payment' }, { status: 500 })
  }
}
