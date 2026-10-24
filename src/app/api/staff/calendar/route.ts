export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { ACTIVE_BOOKING_STATUSES, requireStaff, staffCanSeeBranch } from '@/lib/staff-api'

// GET /api/staff/calendar?month=YYYY-MM[&branch=Christchurch]
// → { days: [{ date, pickups, dropoffs, pendingPickups, pendingDropoffs }] } from the RCM mirror.
// A pick-up is done once RCM shows Hired/Returned or staff finished it in YITU Lite;
// a drop-off once RCM shows Returned or staff finished it.

type DayStats = { date: string; pickups: number; dropoffs: number; pendingPickups: number; pendingDropoffs: number }

export async function GET(req: NextRequest) {
  const auth = await requireStaff(req, 'bookings.read')
  if (auth.response) return auth.response

  const params = new URL(req.url).searchParams
  const month = params.get('month') || ''
  /** Only this branch's pick-ups / drop-offs; all visible branches when empty. */
  const branch = params.get('branch') || ''
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ success: false, error: 'month must be YYYY-MM.' }, { status: 400 })
  }

  try {
    const [year, mon] = month.split('-').map(Number)
    const first = `${month}-01`
    const last = new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10)
    const supabase = getSupabaseAdmin()

    const { data: rows, error } = await supabase
      .from('rcm_bookings')
      .select('reservation_ref, status, pickup_date, dropoff_date, pickup_branch, dropoff_branch')
      .in('status', ACTIVE_BOOKING_STATUSES)
      .or(`and(pickup_date.gte.${first},pickup_date.lte.${last}),and(dropoff_date.gte.${first},dropoff_date.lte.${last})`)
    if (error) throw error

    const refs = (rows || []).map(row => row.reservation_ref)
    const finished = new Set<string>()
    if (refs.length) {
      const { data: completions } = await supabase.from('staff_completions').select('booking_ref, type').in('booking_ref', refs)
      for (const c of completions || []) finished.add(`${c.type}:${c.booking_ref}`)
    }

    const days = new Map<string, DayStats>()
    const day = (date: string) => {
      if (!days.has(date)) days.set(date, { date, pickups: 0, dropoffs: 0, pendingPickups: 0, pendingDropoffs: 0 })
      return days.get(date)!
    }

    for (const row of rows || []) {
      const status = String(row.status)
      if (row.pickup_date >= first && row.pickup_date <= last && staffCanSeeBranch(auth.payload, row.pickup_branch)
          && (!branch || row.pickup_branch === branch)) {
        const stats = day(row.pickup_date)
        stats.pickups++
        const done = status === 'Hired' || status === 'Returned' || finished.has(`pickup:${row.reservation_ref}`)
        if (!done) stats.pendingPickups++
      }
      if (row.dropoff_date >= first && row.dropoff_date <= last && staffCanSeeBranch(auth.payload, row.dropoff_branch)
          && (!branch || row.dropoff_branch === branch)) {
        const stats = day(row.dropoff_date)
        stats.dropoffs++
        const done = status === 'Returned' || finished.has(`dropoff:${row.reservation_ref}`)
        if (!done) stats.pendingDropoffs++
      }
    }

    const { data: state } = await supabase.from('rcm_sync_state').select('value').eq('key', 'incremental').maybeSingle()
    return NextResponse.json({
      success: true,
      month,
      syncedAt: state?.value || null,
      days: Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date)),
    })
  } catch (err: any) {
    console.error('[staff/calendar] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
