export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  try {
    const openid = req.nextUrl.searchParams.get('openid') || req.headers.get('x-openid') || ''
    if (!openid) return NextResponse.json({ error: 'Missing openid' }, { status: 400 })

    const { data, error } = await getSupabase()
      .from('wx_user_coupons')
      .select('id, code, title, discount_type, discount_value, status, expires_at, created_at')
      .eq('openid', openid)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ coupons: data || [] })
  } catch (err: any) {
    console.error('[wx/coupons] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
