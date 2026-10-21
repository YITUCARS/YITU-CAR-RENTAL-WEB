export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmRemoveExtraDriver, rcmSaveExtraDriver } from '@/lib/rcm-post'
import { requireStaff } from '@/lib/staff-api'

// POST /api/staff/extra-driver
// Body: { reservationRef, customerId (0 = new), remove?: boolean,
//         firstName, lastName, dateOfBirth?, email?, phone?, licenseNo?, licenseExpires?, licenseIssued? }
// Adds, updates or removes an additional driver on the RCM booking.
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, 'pickup.manage')
  if (auth.response) return auth.response

  try {
    const body = await req.json()
    const reservationRef = String(body.reservationRef || '')
    const customerId = Number(body.customerId || 0)
    if (!reservationRef) return NextResponse.json({ success: false, error: 'reservationRef is required.' }, { status: 400 })

    if (body.remove) {
      await rcmRemoveExtraDriver(reservationRef, customerId)
      return NextResponse.json({ success: true, customerId: 0 })
    }
    const saved = await rcmSaveExtraDriver(reservationRef, customerId, {
      firstName: String(body.firstName || ''),
      lastName: String(body.lastName || ''),
      dateOfBirth: body.dateOfBirth,
      email: body.email,
      phone: body.phone,
      licenseNo: body.licenseNo,
      licenseExpires: body.licenseExpires,
      licenseIssued: body.licenseIssued,
    })
    console.log('[staff/extra-driver]', reservationRef, customerId ? 'updated' : 'added', saved.customerId, 'by', auth.payload?.staffId)
    return NextResponse.json({ success: true, ...saved })
  } catch (err: any) {
    console.error('[staff/extra-driver] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
