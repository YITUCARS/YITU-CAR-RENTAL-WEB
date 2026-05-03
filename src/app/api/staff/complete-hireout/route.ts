export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

// POST /api/staff/complete-hireout
// Body: {
//   reservationRef: string,
//   staffId?: number,
//   odometer?: string,        // odometer reading at hire-out
//   fuelLevel?: string,       // "Full" | "3/4" | "1/2" | "1/4" | "Empty"
//   notes?: string,
//   paymentMethod?: string,   // "Credit Card" | "EFTPOS" | "Cash" | "Account"
//   paymentAmount?: number,
// }
//
// Calls RCM method "hireout" — verify exact method name against RCM docs.
// Common alternatives: "completehireout", "checkin", "confirmpickup"
export async function POST(req: NextRequest) {
  try {
    const {
      reservationRef,
      staffId,
      odometer,
      fuelLevel,
      notes,
      paymentMethod,
      paymentAmount,
    } = await req.json()

    if (!reservationRef) {
      return NextResponse.json(
        { success: false, error: 'reservationRef is required.' },
        { status: 400 }
      )
    }

    const result = await rcmCall('hireout', {
      reservationref:  reservationRef,
      staffid:         staffId         ?? 0,
      odometerin:      odometer        ?? '',
      fuellevel:       fuelLevel       ?? 'Full',
      notes:           notes           ?? '',
      paymenttype:     paymentMethod   ?? '',
      paymentamount:   paymentAmount   ?? 0,
      emailoption:     1,   // send confirmation email to customer
    })

    return NextResponse.json({ success: true, result })
  } catch (err: any) {
    console.error('[staff/complete-hireout] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
