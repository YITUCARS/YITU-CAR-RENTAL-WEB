export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { normalizeFlightNumber } from '@/lib/aerodatabox'
import { rcmUpdateFlight } from '@/lib/rcm-post'
import { requireStaff } from '@/lib/staff-api'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// POST /api/staff/flight  Body: { reservationRef, flightNumber }  (empty flightNumber clears it)
// Saves the customer's arrival flight in RCM (flightin) and in the YITU Lite mirror.
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, 'pickup.manage')
  if (auth.response) return auth.response

  let ref = ''
  try {
    const { reservationRef, flightNumber } = await req.json()
    ref = String(reservationRef || '')
    const number = normalizeFlightNumber(flightNumber)
    if (!reservationRef || (number && !/^[A-Z0-9]{3,8}$/.test(number))) {
      return NextResponse.json({ success: false, error: 'Enter a flight number like NZ677.' }, { status: 400 })
    }
    const saved = await rcmUpdateFlight(String(reservationRef), number)

    // Update the mirror now so the list shows it before the next sync.
    const supabase = getSupabaseAdmin()
    const { data } = await supabase.from('rcm_bookings').select('details').eq('reservation_ref', reservationRef).maybeSingle()
    if (data?.details) {
      await supabase.from('rcm_bookings')
        .update({ details: { ...data.details, flightIn: saved } })
        .eq('reservation_ref', reservationRef)
    }
    console.log('[staff/flight]', reservationRef, 'flight set by', auth.payload?.staffId)
    return NextResponse.json({ success: true, flightNumber: saved })
  } catch (err: any) {
    console.error('[staff/flight] error:', ref, err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
