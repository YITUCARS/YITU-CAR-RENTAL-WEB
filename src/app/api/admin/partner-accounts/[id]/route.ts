import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { hashPartnerPassword } from '@/lib/partner-auth'

function authorized(req: NextRequest) { return req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD }

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!authorized(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json(); const update: any = {}
    if (body.displayName !== undefined) update.display_name = String(body.displayName).trim()
    if (body.active !== undefined) update.active = Boolean(body.active)
    if (body.discountPercent !== undefined) update.discount_percent = Math.min(100, Math.max(0, Number(body.discountPercent || 0)))
    if (body.notes !== undefined) update.notes = String(body.notes).trim() || null
    if (body.password) { if (String(body.password).length < 8) return NextResponse.json({ success: false, error: '密码至少8位。' }, { status: 400 }); update.password_hash = hashPartnerPassword(String(body.password)) }
    const { error } = await getSupabaseAdmin().from('partner_accounts').update(update).eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!authorized(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const { error } = await getSupabaseAdmin().from('partner_accounts').delete().eq('id', params.id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
