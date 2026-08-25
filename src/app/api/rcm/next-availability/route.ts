import { NextRequest, NextResponse } from 'next/server'
import { findNextAvailability } from '@/lib/next-availability'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const dates = await findNextAvailability({
      pickupLocation: body.pickupLocation,
      dropoffLocation: body.dropoffLocation,
      pickupDate: body.pickupDate,
      pickupTime: body.pickupTime || '10:00',
      dropoffDate: body.dropoffDate,
      dropoffTime: body.dropoffTime || '10:00',
      promoCode: body.promoCode,
      vehicleIds: Array.isArray(body.vehicleIds) ? body.vehicleIds.map(Number).filter(Number.isFinite) : [],
    })
    return NextResponse.json({ success: true, dates })
  } catch (error: any) {
    console.error('[next-availability] error:', error.message)
    return NextResponse.json({ success: false, error: 'Unable to check future availability.' }, { status: 500 })
  }
}
