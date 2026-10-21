export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireStaff, staffCanSeeBranch } from '@/lib/staff-api'

// GET /api/staff/notifications → recent new-booking alerts the staff member can see.
export async function GET(req: NextRequest) {
  const auth = await requireStaff(req, 'bookings.read')
  if (auth.response) return auth.response

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('staff_notifications')
      .select('kind, booking_ref, reservation_no, branch, title, body, pickup_date, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    const notifications = (data || [])
      .filter(row => !row.branch || staffCanSeeBranch(auth.payload, row.branch))
      .slice(0, 50)
      .map(row => ({
        kind: row.kind,
        bookingRef: row.booking_ref,
        reservationNo: row.reservation_no,
        branch: row.branch,
        title: row.title,
        body: row.body,
        pickupDate: row.pickup_date,
        createdAt: row.created_at,
      }))
    return NextResponse.json({ success: true, notifications })
  } catch (err: any) {
    console.error('[staff/notifications] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
