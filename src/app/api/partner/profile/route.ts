import { NextRequest, NextResponse } from 'next/server'
import { readPartnerSession } from '@/lib/partner-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(req: NextRequest) {
  const session = readPartnerSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim()
  const phone = String(body.phone || '').trim()
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: '请输入有效的企业邮箱' }, { status: 400 })
  if (!phone) return NextResponse.json({ error: '请输入企业电话' }, { status: 400 })
  const { data, error } = await getSupabaseAdmin().from('partner_accounts').update({ contact_email: email, contact_phone: phone }).eq('id', session.id).select('contact_email,contact_phone').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, profile: data })
}
