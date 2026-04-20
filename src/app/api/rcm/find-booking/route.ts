export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

export async function POST(req: NextRequest) {
  try {
    const { reservationRef, lastName } = await req.json()

    if (!reservationRef || !lastName) {
      return NextResponse.json(
        { success: false, error: 'Please provide both a confirmation number and last name.' },
        { status: 400 }
      )
    }

    const ref = reservationRef.trim()
    const name = lastName.trim()

    let info: any = null

    // Attempt 1: reservationref (long alphanumeric like 001912BA8D6420D) + lastname
    try {
      info = await rcmCall('bookinginfo', { reservationref: ref, lastname: name })
      console.log('[find-booking] attempt 1 (reservationref+lastname) succeeded')
    } catch (e1: any) {
      console.log('[find-booking] attempt 1 failed:', e1.message)

      // Attempt 2: reservationno as number + lastname (for short numeric booking numbers)
      const asNumber = Number(ref)
      if (Number.isFinite(asNumber) && asNumber > 0) {
        try {
          info = await rcmCall('bookinginfo', { reservationno: asNumber, lastname: name })
          console.log('[find-booking] attempt 2 (reservationno+lastname) succeeded')
        } catch (e2: any) {
          console.log('[find-booking] attempt 2 failed:', e2.message)
        }
      }

      // Attempt 3: reservationref + email (in case API uses email not lastname)
      if (!info) {
        try {
          info = await rcmCall('bookinginfo', { reservationref: ref, email: name })
          console.log('[find-booking] attempt 3 (reservationref+email) succeeded')
        } catch (e3: any) {
          console.log('[find-booking] attempt 3 failed:', e3.message)
        }
      }

      // Attempt 4: reservationno + email
      if (!info) {
        const asNumber = Number(ref)
        if (Number.isFinite(asNumber) && asNumber > 0) {
          try {
            info = await rcmCall('bookinginfo', { reservationno: asNumber, email: name })
            console.log('[find-booking] attempt 4 (reservationno+email) succeeded')
          } catch (e4: any) {
            console.log('[find-booking] attempt 4 failed:', e4.message)
          }
        }
      }

      if (!info) {
        return NextResponse.json(
          { success: false, error: 'No booking found. Please check your booking number and last name.' },
          { status: 404 }
        )
      }
    }

    // Validate last name against what the booking actually has
    const bookingLastName = (
      info?.customerinfo?.[0]?.lastname ??
      info?.lastname ??
      ''
    ).toLowerCase().trim()

    if (bookingLastName && bookingLastName !== name.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'The last name does not match this booking. Please check and try again.' },
        { status: 403 }
      )
    }

    console.log('[find-booking] response keys:', Object.keys(info || {}))

    return NextResponse.json({ success: true, booking: info })
  } catch (err: any) {
    console.error('[find-booking] unexpected error:', err.message)
    return NextResponse.json(
      { success: false, error: err.message || 'Unexpected error. Please try again.' },
      { status: 500 }
    )
  }
}
