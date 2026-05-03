export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getStaffBookingDetail, requireStaff } from '@/lib/staff-api'

export async function GET(
  req: NextRequest,
  { params }: { params: { ref: string } }
) {
  const auth = requireStaff(req)
  if (auth.response) return auth.response

  try {
    const booking = await getStaffBookingDetail(decodeURIComponent(params.ref))
    return NextResponse.json({ success: true, booking })
  } catch (err: any) {
    console.error('[staff/bookings/ref] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
