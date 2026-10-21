import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

function auth(req: NextRequest) { return req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD }
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getSupabaseAdmin()
  const [{ data: accounts, error: ae }, { data: bookings, error: be }] = await Promise.all([
    supabase.from('partner_accounts').select('id,username,display_name,discount_percent,active').order('display_name'),
    supabase.from('partner_bookings').select('*').order('created_at', { ascending: false })
  ])
  if (ae || be) return NextResponse.json({ error: (ae || be)?.message }, { status: 500 })
  const statementMap = new Map<string, any>()
  for (const booking of bookings || []) {
    const month = String(booking.pickup_date || booking.created_at || '').slice(0, 7)
    const key = `${booking.partner_account_id}:${month}`
    const item = statementMap.get(key) || { partnerAccountId: booking.partner_account_id, month, bookings: 0, total: 0, originalTotal: 0 }
    item.bookings += 1; item.total += Number(booking.partner_total || 0); item.originalTotal += Number(booking.original_total || 0)
    statementMap.set(key, item)
  }
  return NextResponse.json({ accounts: accounts || [], statements: Array.from(statementMap.values()), bookings: bookings || [] })
}
