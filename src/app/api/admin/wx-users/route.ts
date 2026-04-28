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

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const { data: users, error: userError } = await supabase
      .from('wx_users')
      .select('openid, nick_name, avatar_url, last_login_at, created_at')
      .order('last_login_at', { ascending: false })

    if (userError) throw userError

    const { data: coupons, error: couponError } = await supabase
      .from('wx_user_coupons')
      .select('openid, id')

    if (couponError) throw couponError

    const counts = new Map<string, number>()
    ;(coupons || []).forEach(item => {
      counts.set(item.openid, (counts.get(item.openid) || 0) + 1)
    })

    return NextResponse.json({
      users: (users || []).map(user => ({
        ...user,
        coupon_count: counts.get(user.openid) || 0,
      })),
    })
  } catch (err: any) {
    console.error('[admin/wx-users] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
