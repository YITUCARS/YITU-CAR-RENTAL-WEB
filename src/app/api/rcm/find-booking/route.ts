export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

function normalizeRef(value: any) {
  return String(value || '').trim().replace(/^#/, '')
}

async function tryBookingInfo(params: Record<string, any>, label: string) {
  try {
    const info = await rcmCall('bookinginfo', params)
    console.log(`[find-booking] ${label} succeeded`)
    return info
  } catch (err: any) {
    console.log(`[find-booking] ${label} failed:`, err.message)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const reservationRef = body.reservationRef || body.ref || body.bookingReference || body.bookingRef
    const reservationNo = body.reservationNo || body.reservationno
    const lastName = body.lastName || body.name

    if (!reservationRef || !lastName) {
      return NextResponse.json(
        { success: false, error: 'Please provide both a confirmation number and last name.' },
        { status: 400 }
      )
    }

    const ref = normalizeRef(reservationRef)
    const no = normalizeRef(reservationNo)
    const name = String(lastName || '').trim()

    let info: any = null

    const numericRefs = Array.from(new Set([ref, no].filter(Boolean))).filter((value) => {
      const n = Number(value)
      return Number.isFinite(n) && n > 0
    })

    const alphaRefs = Array.from(new Set([ref, no].filter(Boolean)))
    for (const value of alphaRefs) {
      info =
        (await tryBookingInfo({ reservationref: value, lastname: name }, 'reservationref+lastname')) ||
        (await tryBookingInfo({ bookingref: value, lastname: name }, 'bookingref+lastname')) ||
        (await tryBookingInfo({ refno: value, lastname: name }, 'refno+lastname')) ||
        (await tryBookingInfo({ reservationref: value, email: name }, 'reservationref+email')) ||
        (await tryBookingInfo({ bookingref: value, email: name }, 'bookingref+email')) ||
        (await tryBookingInfo({ refno: value, email: name }, 'refno+email'))
      if (info) break
    }

    if (!info) {
      for (const value of numericRefs) {
        const n = Number(value)
        info =
          (await tryBookingInfo({ reservationno: n, lastname: name }, 'reservationno+lastname')) ||
          (await tryBookingInfo({ reservationno: n, email: name }, 'reservationno+email'))
        if (info) break
      }
    }

    if (!info) {
      return NextResponse.json(
        { success: false, error: 'No booking found. Please check your booking number and last name.' },
        { status: 404 }
      )
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
