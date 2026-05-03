export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { toRCMDate } from '@/lib/rcm'
import { getStaffBookings, requireStaff } from '@/lib/staff-api'

export async function GET(req: NextRequest) {
  const auth = requireStaff(req)
  if (auth.response) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const type = searchParams.get('type') === 'dropoff' ? 'dropoff' : 'pickup'
    const status = searchParams.get('status') || undefined

    if (!date) {
      return NextResponse.json({ success: false, error: 'date query param required (YYYY-MM-DD).' }, { status: 400 })
    }

    const bookings = await getStaffBookings({
      date: toRCMDate(date),
      type,
      status,
    })

    return NextResponse.json({ success: true, bookings })
  } catch (err: any) {
    console.error('[staff/bookings] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
