export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

function isAdmin(req: NextRequest) {
  if (req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD) return true
  const openid = req.headers.get('x-openid') || ''
  const allowed = (process.env.WX_ADMIN_OPENIDS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  return !!openid && allowed.includes(openid)
}

function randomCode(discountValue: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 5; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
  return `YITU${discountValue}${suffix}`
}

async function getAccessToken() {
  const appid = process.env.WX_APPID
  const secret = process.env.WX_APP_SECRET
  if (!appid || !secret) return ''
  const res = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`)
  const data = await res.json()
  return data.access_token || ''
}

async function sendCouponNotice(openid: string, code: string, discountValue: number) {
  const templateId = process.env.WX_COUPON_TEMPLATE_ID
  if (!templateId) return { sent: false, reason: 'missing_template_id' }

  const token = await getAccessToken()
  if (!token) return { sent: false, reason: 'missing_access_token' }

  const res = await fetch(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      touser: openid,
      template_id: templateId,
      page: 'pages/profile/index',
      data: {
        thing1: { value: '一途租车优惠卡券' },
        character_string2: { value: code },
        thing3: { value: `${discountValue}%折扣，进入我的卡券复制使用` },
      },
    }),
  })
  const data = await res.json()
  return { sent: data.errcode === 0, response: data }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const openid = String(body.openid || '').trim()
    const discountValue = Number(body.discount_value || body.discountValue || 10)
    const code = String(body.code || randomCode(discountValue)).trim().toUpperCase()
    const title = String(body.title || `${discountValue}%优惠卡`).trim()
    const expiresAt = body.expires_at || body.expiresAt || null

    if (!openid) return NextResponse.json({ error: 'Missing openid' }, { status: 400 })
    if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 100) {
      return NextResponse.json({ error: 'Invalid discount value' }, { status: 400 })
    }

    const supabase = getSupabase()
    const { data: existingPromo, error: findPromoError } = await supabase
      .from('promo_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    if (findPromoError) throw findPromoError

    const promoPayload = {
        code,
        discount_type: 'percent',
        discount_value: discountValue,
        active: true,
        expires_at: expiresAt,
    }

    const promoResult = existingPromo
      ? await supabase.from('promo_codes').update(promoPayload).eq('id', existingPromo.id)
      : await supabase.from('promo_codes').insert(promoPayload)

    if (promoResult.error) throw promoResult.error

    const { data, error } = await supabase
      .from('wx_user_coupons')
      .insert({
        openid,
        code,
        title,
        discount_type: 'percent',
        discount_value: discountValue,
        status: 'unused',
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (error) throw error

    const notice = await sendCouponNotice(openid, code, discountValue)
    return NextResponse.json({ coupon: data, notification: notice })
  } catch (err: any) {
    console.error('[admin/wx-coupons] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
