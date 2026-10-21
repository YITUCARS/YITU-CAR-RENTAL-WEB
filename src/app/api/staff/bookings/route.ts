export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getStaffBookings, requireStaff, staffCanSeeBranch } from '@/lib/staff-api'

export async function GET(req: NextRequest) {
  const auth = await requireStaff(req, 'bookings.read')
  if (auth.response) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const type = searchParams.get('type') === 'dropoff' ? 'dropoff' : 'pickup'
    const status = searchParams.get('status') || undefined
    // Pull-to-refresh; still bounded by the Export API daily budget.
    const force = searchParams.get('refresh') === '1'
    if (force) {
      const refreshAuth = await requireStaff(req, 'bookings.refresh')
      if (refreshAuth.response) return refreshAuth.response
    }

    if (!date) {
      return NextResponse.json({ success: false, error: 'date query param required (YYYY-MM-DD).' }, { status: 400 })
    }

    const bookings = await getStaffBookings({ date, type, status, force })

    return NextResponse.json({
      success: true,
      bookings: bookings.filter((booking: any) => staffCanSeeBranch(auth.payload, booking.branch)),
      fetchedAt: new Date(bookings.fetchedAt).toISOString(),
      stale: bookings.stale,
    })
  } catch (err: any) {
    console.error('[staff/bookings] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
