export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

// POST /api/staff/complete-return
// Body: {
//   reservationRef: string,
//   staffId?: number,
//   odometer: string,          // odometer reading at return
//   fuelLevel: string,         // "Full" | "3/4" | "1/2" | "1/4" | "Empty"
//   hasNewDamage: boolean,
//   damageNotes?: string,
//   additionalCharge?: number, // extra charge for new damage (NZD)
// }
//
// Calls RCM method "return" — verify exact method name against RCM docs.
// Common alternatives: "completereturn", "checkout", "confirmreturn"
export async function POST(req: NextRequest) {
  try {
    const {
      reservationRef,
      staffId,
      odometer,
      fuelLevel,
      hasNewDamage,
      damageNotes,
      additionalCharge,
    } = await req.json()

    if (!reservationRef) {
      return NextResponse.json(
        { success: false, error: 'reservationRef is required.' },
        { status: 400 }
      )
    }

    const result = await rcmCall('return', {
      reservationref:    reservationRef,
      staffid:           staffId          ?? 0,
      odometerout:       odometer         ?? '',
      fuellevel:         fuelLevel        ?? 'Full',
      damagenotes:       hasNewDamage ? (damageNotes ?? '') : '',
      newdamage:         hasNewDamage ? 1 : 0,
      additionalcharge:  additionalCharge ?? 0,
      emailoption:       1,   // send return confirmation email to customer
    })

    return NextResponse.json({ success: true, result })
  } catch (err: any) {
    console.error('[staff/complete-return] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
