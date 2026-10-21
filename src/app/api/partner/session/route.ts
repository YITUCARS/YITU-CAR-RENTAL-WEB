import { NextRequest, NextResponse } from 'next/server'
import { readPartnerSession } from '@/lib/partner-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
export async function GET(req: NextRequest) {
  const session = readPartnerSession(req)
  if (!session) return NextResponse.json({ success: false }, { status: 401 })
  const { data } = await getSupabaseAdmin().from('partner_accounts').select('username,display_name,contact_email,contact_phone,discount_percent').eq('id', session.id).maybeSingle()
  return NextResponse.json({ success: true, account: { username: session.username, displayName: data?.display_name || session.displayName, contactEmail: data?.contact_email || '', contactPhone: data?.contact_phone || '', discountPercent: Number(data?.discount_percent ?? session.discountPercent ?? 0) } }, { headers: { 'Cache-Control': 'no-store' } })
}
