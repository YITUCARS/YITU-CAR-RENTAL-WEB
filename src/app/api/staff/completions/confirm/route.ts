export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/staff-api'
import { confirmRcmUpdated } from '@/lib/staff-completions'

// POST /api/staff/completions/confirm  Body: { bookingRef, type }
// Ticks off the RCM checklist item. Admins only (staff_accounts role "manager").
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, 'completions.confirm')
  if (auth.response) return auth.response

  try {
    const body = await req.json()
    const type = body.type === 'dropoff' ? 'dropoff' : body.type === 'pickup' ? 'pickup' : null
    if (!body.bookingRef || !type) {
      return NextResponse.json({ success: false, error: 'bookingRef and type are required.' }, { status: 400 })
    }
    const completion = await confirmRcmUpdated(String(body.bookingRef), type, auth.payload!.staffId)
    return NextResponse.json({ success: true, completion })
  } catch (err: any) {
    console.error('[staff/completions/confirm] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
