export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const openid = String(body.openid || req.headers.get('x-openid') || '').trim()
    const nickName = String(body.nickName || body.nick_name || '微信用户').trim()
    const avatarUrl = String(body.avatarUrl || body.avatar_url || '').trim()

    if (!openid) return NextResponse.json({ error: 'Missing openid' }, { status: 400 })

    const { error } = await getSupabase()
      .from('wx_users')
      .upsert({
        openid,
        nick_name: nickName || '微信用户',
        avatar_url: avatarUrl || null,
        last_login_at: new Date().toISOString(),
      }, { onConflict: 'openid' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[wx/profile] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
