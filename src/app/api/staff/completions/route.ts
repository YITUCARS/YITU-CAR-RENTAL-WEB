export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, staffCanSeeBranch } from '@/lib/staff-api'
import { isStaffAdmin, listCompletions, recordCompletion } from '@/lib/staff-completions'

// GET  /api/staff/completions → { pending, today, recentDone, canConfirm }
// POST /api/staff/completions  Body: { bookingRef, type, reservationNo?, customerName?, vehicle?, plate?, branch? }
export async function GET(req: NextRequest) {
  const auth = await requireStaff(req, 'bookings.read')
  if (auth.response) return auth.response

  try {
    const lists = await listCompletions()
    const visible = (rows: any[]) => rows.filter(row => !row.branch || staffCanSeeBranch(auth.payload, row.branch))
    return NextResponse.json({
      success: true,
      canConfirm: isStaffAdmin(auth.payload),
      pending: visible(lists.pending),
      today: visible(lists.today),
      recentDone: visible(lists.recentDone),
    })
  } catch (err: any) {
    console.error('[staff/completions] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const type = body.type === 'dropoff' ? 'dropoff' : body.type === 'pickup' ? 'pickup' : null
    if (!body.bookingRef || !type) {
      return NextResponse.json({ success: false, error: 'bookingRef and type are required.' }, { status: 400 })
    }
    const auth = await requireStaff(req, type === 'pickup' ? 'pickup.manage' : 'dropoff.manage')
    if (auth.response) return auth.response
    const completion = await recordCompletion({
      bookingRef: String(body.bookingRef),
      type,
      reservationNo: body.reservationNo,
      customerName: body.customerName,
      vehicle: body.vehicle,
      plate: body.plate,
      branch: body.branch,
      completedBy: auth.payload!.staffId,
    })
    return NextResponse.json({ success: true, completion })
  } catch (err: any) {
    console.error('[staff/completions] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
