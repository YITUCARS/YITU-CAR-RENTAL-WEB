import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { hashPartnerPassword } from '@/lib/partner-auth'

function authorized(req: NextRequest) { return req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD }

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  try { const { data, error } = await getSupabaseAdmin().from('partner_accounts').select('id,username,display_name,active,discount_percent,remember_days,notes,last_login_at,created_at,updated_at').order('created_at', { ascending: false }); if (error) throw error; return NextResponse.json({ success: true, accounts: data || [] }) } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const username = String(body.username || '').trim().toLowerCase()
    const displayName = String(body.displayName || '').trim()
    const password = String(body.password || '')
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || !displayName || password.length < 8) return NextResponse.json({ success: false, error: '用户名至少3位，只能使用英文、数字、点、下划线或短横线；密码至少8位。' }, { status: 400 })
    const { data, error } = await getSupabaseAdmin().from('partner_accounts').insert({ username, display_name: displayName, password_hash: hashPartnerPassword(password), active: body.active !== false, discount_percent: Math.min(100, Math.max(0, Number(body.discountPercent || 0))), remember_days: 30, notes: String(body.notes || '').trim() || null }).select('id,username,display_name,active,discount_percent,remember_days,notes,last_login_at,created_at').single()
    if (error) throw error
    return NextResponse.json({ success: true, account: data })
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }) }
}
