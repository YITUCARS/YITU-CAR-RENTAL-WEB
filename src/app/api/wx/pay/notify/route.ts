export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptWechatPayResource } from '@/lib/wechat-pay'
import { rcmConfirmPayment } from '@/lib/rcm'
import { notifyWebsitePaymentReceived } from '@/lib/rcm-telegram'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function success() {
  return NextResponse.json({ code: 'SUCCESS', message: '成功' })
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
  if (!params.reservationRef || !params.depositNzd) return null

  const supplierId = Number(process.env.RCM_WECHATPAY_SUPPLIER_ID || process.env.RCM_STRIPE_SUPPLIER_ID || 5)
  const result = await rcmConfirmPayment({
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

  if (result?.paymentsaved !== true) {
    console.warn('[wx/pay/notify] RCM did not mark payment saved:', JSON.stringify(result))
  }
  return result
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const eventType = String(body?.event_type || '')
    const transaction = decryptWechatPayResource(body.resource)

    if (eventType !== 'TRANSACTION.SUCCESS' || transaction.trade_state !== 'SUCCESS') {
      console.warn('[wx/pay/notify] ignored event:', eventType, transaction.trade_state)
      return success()
    }

    let attach: any = {}
    try {
      attach = transaction.attach ? JSON.parse(transaction.attach) : {}
    } catch {}

    const reservationRef = attach.reservationRef || ''
    const openid = attach.openid || transaction?.payer?.openid || ''
    const outTradeNo = transaction.out_trade_no || ''
    const amountFen = Number(transaction?.amount?.payer_total || transaction?.amount?.total || 0)
    let depositNzd = toMoney(attach.depositNzd)

    const supabase = getSupabase()
    let alreadyConfirmed = false
    if (supabase && reservationRef && openid) {
      const { data } = await supabase
        .from('wx_user_bookings')
        .select('deposit, deposit_paid, status')
        .eq('openid', openid)
        .eq('reservation_ref', reservationRef)
        .maybeSingle()
      depositNzd = depositNzd || toMoney(data?.deposit)
      alreadyConfirmed = data?.deposit_paid === true && String(data?.status || '').toLowerCase() === 'reservation'

      let rcmResult: any = null
      if (!alreadyConfirmed) {
        try {
          rcmResult = await confirmRcmDeposit({ reservationRef, depositNzd, outTradeNo })
        } catch (err: any) {
          console.error('[wx/pay/notify] RCM confirm failed:', err.message)
        }
      }

      const payload: any = {
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        wx_pay_out_trade_no: outTradeNo,
        wx_pay_amount_cny: amountFen / 100,
      }
      if (alreadyConfirmed || rcmResult?.paymentsaved === true) payload.status = 'reservation'
      const { error } = await supabase
        .from('wx_user_bookings')
        .update(payload)
        .eq('openid', openid)
        .eq('reservation_ref', reservationRef)

      if (error && /deposit_paid|deposit_paid_at|wx_pay_out_trade_no|wx_pay_amount_cny/.test(error.message || '')) {
        console.warn('[wx/pay/notify] payment columns unavailable:', error.message)
      } else if (error) {
        throw error
      }
    }

    if (reservationRef && depositNzd) {
      try {
        await notifyWebsitePaymentReceived({
          reservationRef,
          amount: depositNzd,
          paymentIntentId: outTradeNo,
          paymentMethod: 'wechatpay',
          paymentChannel: 'wechat_miniprogram',
        })
      } catch (error) {
        console.error('[wx/pay/notify] Telegram payment notification failed:', error instanceof Error ? error.message : error)
      }
    }

    return success()
  } catch (err: any) {
    console.error('[wx/pay/notify] error:', err.message)
    return NextResponse.json({ code: 'FAIL', message: err.message || '失败' }, { status: 500 })
  }
}
