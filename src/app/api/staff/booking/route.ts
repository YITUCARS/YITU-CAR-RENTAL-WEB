export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

// POST /api/staff/booking
// Body: { reservationRef: string } | { reservationNo: number }
// Returns full booking detail from RCM bookinginfo
export async function POST(req: NextRequest) {
  try {
    const { reservationRef, reservationNo } = await req.json()

    if (!reservationRef && !reservationNo) {
      return NextResponse.json(
        { success: false, error: 'reservationRef or reservationNo required.' },
        { status: 400 }
      )
    }

    const params: Record<string, any> = {}
    if (reservationRef) params.reservationref = reservationRef
    if (reservationNo)  params.reservationno  = Number(reservationNo)

    const result = await rcmCall('bookinginfo', params)
    const info   = Array.isArray(result) ? result[0] : result

    return NextResponse.json({ success: true, booking: info })
  } catch (err: any) {
    console.error('[staff/booking] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
