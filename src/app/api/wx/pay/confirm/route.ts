export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rcmConfirmPayment } from '@/lib/rcm'
import { getWechatPayConfig, wechatPayGet } from '@/lib/wechat-pay'
import { notifyWebsitePaymentReceived } from '@/lib/rcm-telegram'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function formatRcmDate(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function toMoney(value: any) {
  const n = Number(value || 0)
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0
}

async function confirmRcmDeposit(params: {
  reservationRef: string
  depositNzd: number
  outTradeNo: string
}) {
  const supplierId = Number(process.env.RCM_WECHATPAY_SUPPLIER_ID || process.env.RCM_STRIPE_SUPPLIER_ID || 5)
  return rcmConfirmPayment({
    reservationRef: params.reservationRef,
    amount: params.depositNzd,
    success: true,
    payType: 'WECHATPAY',
    payDate: formatRcmDate(),
    supplierId,
    transactId: params.outTradeNo,
    dpsTxnRef: params.outTradeNo,
    cardHolder: 'WeChat Pay',
    paySource: 'WeChat Mini Program',
  })
}

export async function POST(req: NextRequest) {
  try {
    const cfg = getWechatPayConfig()
    const body = await req.json()
    const openid = req.headers.get('x-openid') || body.openid || ''
    const reservationRef = String(body.reservationRef || '').trim()
    const outTradeNo = String(body.outTradeNo || '').trim()

    if (!openid) return NextResponse.json({ success: false, error: 'Missing openid' }, { status: 401 })
    if (!reservationRef || !outTradeNo) {
      return NextResponse.json({ success: false, error: 'Missing reservationRef or outTradeNo' }, { status: 400 })
    }

    const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(cfg.mchid)}`
    const transaction = await wechatPayGet(path)

    if (transaction.trade_state !== 'SUCCESS') {
      return NextResponse.json(
        { success: false, error: `微信支付状态为 ${transaction.trade_state || 'UNKNOWN'}`, data: transaction },
        { status: 409 },
      )
    }

    let attach: any = {}
    try {
      attach = transaction.attach ? JSON.parse(transaction.attach) : {}
    } catch {}

    const attachedOpenid = attach.openid || transaction?.payer?.openid || ''
    const attachedRef = attach.reservationRef || ''
    if ((attachedOpenid && attachedOpenid !== openid) || (attachedRef && attachedRef !== reservationRef)) {
      return NextResponse.json({ success: false, error: 'Payment does not match this booking.' }, { status: 403 })
    }

    let depositNzd = toMoney(attach.depositNzd || body.depositNzd)
    const supabase = getSupabase()
    let alreadyConfirmed = false
    if (supabase) {
      const { data } = await supabase
        .from('wx_user_bookings')
        .select('deposit, deposit_paid, status')
        .eq('openid', openid)
        .eq('reservation_ref', reservationRef)
        .maybeSingle()
      depositNzd = depositNzd || toMoney(data?.deposit)
      alreadyConfirmed = data?.deposit_paid === true && String(data?.status || '').toLowerCase() === 'reservation'
    }

    if (!depositNzd) {
      return NextResponse.json({ success: false, error: 'Missing NZD deposit amount.' }, { status: 400 })
    }

    const rcmResult = alreadyConfirmed
      ? { paymentsaved: true, alreadyConfirmed: true }
      : await confirmRcmDeposit({ reservationRef, depositNzd, outTradeNo })
    if (rcmResult?.paymentsaved !== true) {
      return NextResponse.json(
        { success: false, error: 'RCM did not confirm payment.', data: rcmResult },
        { status: 502 },
      )
    }

    const amountFen = Number(transaction?.amount?.payer_total || transaction?.amount?.total || 0)
    if (supabase) {
      const { error } = await supabase
        .from('wx_user_bookings')
        .update({
          status: 'reservation',
          deposit_paid: true,
          deposit_paid_at: new Date().toISOString(),
          wx_pay_out_trade_no: outTradeNo,
          wx_pay_amount_cny: amountFen / 100,
        })
        .eq('openid', openid)
        .eq('reservation_ref', reservationRef)
      if (error && /status|deposit_paid|deposit_paid_at|wx_pay_out_trade_no|wx_pay_amount_cny/.test(error.message || '')) {
        console.warn('[wx/pay/confirm] payment columns unavailable:', error.message)
      } else if (error) {
        throw error
      }
    }

    try {
      await notifyWebsitePaymentReceived({
        reservationRef,
        amount: depositNzd,
        paymentIntentId: outTradeNo,
        paymentMethod: 'wechatpay',
        paymentChannel: 'wechat_miniprogram',
      })
    } catch (error) {
      console.error('[wx/pay/confirm] Telegram payment notification failed:', error instanceof Error ? error.message : error)
    }

    return NextResponse.json({
      success: true,
      reservationRef,
      outTradeNo,
      depositNzd: depositNzd.toFixed(2),
      amountCny: (amountFen / 100).toFixed(2),
      data: rcmResult,
    })
  } catch (err: any) {
    console.error('[wx/pay/confirm] error:', err.message)
    return NextResponse.json({ success: false, error: err.message || 'Failed to confirm WeChat payment' }, { status: 500 })
  }
}
