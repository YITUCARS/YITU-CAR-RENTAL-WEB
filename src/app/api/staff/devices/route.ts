export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireStaff } from '@/lib/staff-api'

// POST /api/staff/devices  Body: { token, environment: 'sandbox' | 'production', remove?: boolean }
// Registers (or removes, on sign-out) the phone's APNs token for push notifications.
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, 'bookings.read')
  if (auth.response) return auth.response

  try {
    const body = await req.json()
    const token = String(body.token || '').trim()
    if (!/^[0-9a-f]{32,200}$/i.test(token)) {
      return NextResponse.json({ success: false, error: 'A valid device token is required.' }, { status: 400 })
    }
    const supabase = getSupabaseAdmin()
    if (body.remove) {
      await supabase.from('staff_devices').delete().eq('device_token', token)
      return NextResponse.json({ success: true })
    }
    // One row per phone: a token re-registered by another staff member moves to them.
    const { error } = await supabase.from('staff_devices').upsert({
      device_token: token,
      staff_id: auth.payload!.staffId,
      environment: body.environment === 'sandbox' ? 'sandbox' : 'production',
      last_seen_at: new Date().toISOString(),
    })
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[staff/devices] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
