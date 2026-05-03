export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'
import { requireStaff } from '@/lib/staff-api'

export async function POST(req: NextRequest) {
  const auth = requireStaff(req)
  if (auth.response) return auth.response

  try {
    const body = await req.json()
    const { reservationRef, odometer, fuelLevel, additionalCharge, notes } = body

    if (!reservationRef) {
      return NextResponse.json({ success: false, error: 'reservationRef is required.' }, { status: 400 })
    }

    const result = await rcmCall(process.env.RCM_COMPLETE_DROPOFF_METHOD || 'return', {
      reservationref: reservationRef,
      staffid: auth.payload?.staffId ?? 0,
      odometerout: odometer ?? '',
      fuellevel: fuelLevel ?? 'Full',
      damagenotes: notes ?? '',
      newdamage: notes ? 1 : 0,
      additionalcharge: Number(additionalCharge ?? 0),
      emailoption: 1,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[staff/complete-dropoff] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
