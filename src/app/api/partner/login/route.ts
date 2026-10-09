import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { issuePartnerSession, setPartnerCookie, verifyPartnerPassword } from '@/lib/partner-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const username = String(body.username || '').trim().toLowerCase()
    const password = String(body.password || '')
    const remember = Boolean(body.remember)
    if (!username || !password) return NextResponse.json({ success: false, error: 'Please enter your username and password.' }, { status: 400 })
    const { data, error } = await getSupabaseAdmin().from('partner_accounts').select('*').eq('username', username).eq('active', true).maybeSingle()
    if (error) throw error
    if (!data || !verifyPartnerPassword(password, data.password_hash)) return NextResponse.json({ success: false, error: 'Invalid username or password.' }, { status: 401 })
    await getSupabaseAdmin().from('partner_accounts').update({ last_login_at: new Date().toISOString() }).eq('id', data.id)
    const response = NextResponse.json({ success: true, account: { username: data.username, displayName: data.display_name } })
    setPartnerCookie(response, issuePartnerSession(data, remember), remember)
    return response
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Partner login is not available yet.' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set('yitu-partner-session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
  return response
}
