export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { CheckinError, latestCheckins, sendCheckinLink } from '@/lib/online-checkin'
import { requireStaff } from '@/lib/staff-api'

// GET /api/staff/checkin?refs=REF1,REF2  → { success, checkins: { [ref]: { status, submittedAt, ... } } }
export async function GET(req: NextRequest) {
  const auth = await requireStaff(req, 'bookings.read')
  if (auth.response) return auth.response

  try {
    const refs = String(req.nextUrl.searchParams.get('refs') || '')
      .split(',').map(ref => ref.trim()).filter(Boolean).slice(0, 100)
    return NextResponse.json({ success: true, checkins: await latestCheckins(refs) })
  } catch (err: any) {
    console.error('[staff/checkin] list error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// POST /api/staff/checkin  Body: { reservationRef, to? }
// Emails the hirer an online check-in link (to defaults to the RCM customer email).
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, 'pickup.manage')
  if (auth.response) return auth.response

  try {
    const { reservationRef, to } = await req.json()
    if (!reservationRef) return NextResponse.json({ success: false, error: 'reservationRef is required.' }, { status: 400 })
    const sent = await sendCheckinLink({
      reservationRef: String(reservationRef),
      staffId: String(auth.payload?.staffId || ''),
      to: to ? String(to) : undefined,
    })
    console.log('[staff/checkin]', reservationRef, 'link sent by', auth.payload?.staffId)
    return NextResponse.json({ success: true, ...sent })
  } catch (err: any) {
    if (err instanceof CheckinError) return NextResponse.json({ success: false, error: err.message }, { status: 400 })
    console.error('[staff/checkin] send error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
