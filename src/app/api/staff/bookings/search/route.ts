export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { ACTIVE_BOOKING_STATUSES, mirrorRowToBooking, requireStaff, staffCanSeeBranch } from '@/lib/staff-api'

// GET /api/staff/bookings/search?q=1872
// Finds bookings on any date in the RCM mirror: digits match the reservation number (or the
// shorter number RCM uses while unallocated), anything else the customer's name. Each booking is
// returned for the step staff would open next: pick-up until it's on hire, then drop-off.
export async function GET(req: NextRequest) {
  const auth = await requireStaff(req, 'bookings.read')
  if (auth.response) return auth.response

  const q = String(new URL(req.url).searchParams.get('q') || '').trim().replace(/^#/, '')
  if (q.length < 2) return NextResponse.json({ success: true, bookings: [] })

  try {
    let query = getSupabaseAdmin()
      .from('rcm_bookings')
      .select('*')
      .in('status', ACTIVE_BOOKING_STATUSES)
      .order('pickup_date', { ascending: false })
      .limit(20)
    query = /^\d+$/.test(q)
      ? query.or(`reservation_no.eq.${q},details->>unallocatedReservationNo.eq.${q}`)
      : query.ilike('customer_name', `%${q.replace(/[%_,()]/g, '')}%`)
    const { data, error } = await query
    if (error) throw error

    const bookings = (data || [])
      .map((row: any) => {
        const status = String(row.status || '').toLowerCase()
        return mirrorRowToBooking(row, status === 'hired' || status === 'returned' ? 'dropoff' : 'pickup')
      })
      .filter((booking: any) => staffCanSeeBranch(auth.payload, booking.branch))
    return NextResponse.json({ success: true, bookings })
  } catch (err: any) {
    console.error('[staff/bookings/search] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
