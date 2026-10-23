export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getFlightStatus, isAeroDataBoxConfigured, normalizeFlightNumber } from '@/lib/aerodatabox'
import { requireStaff } from '@/lib/staff-api'

// POST /api/staff/flight-status
// Body: { flights: [{ bookingRef, flightNumber, date (yyyy-MM-dd), branch? }] }
// Live arrival status for the pick-up cards. Only today's (NZ) flights are looked up, to keep
// within the AeroDataBox quota.

const BRANCH_AIRPORT: Record<string, string> = { Christchurch: 'CHC', Queenstown: 'ZQN', Auckland: 'AKL' }

function nzDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff(req)
  if (auth.response) return auth.response
  if (!isAeroDataBoxConfigured()) return NextResponse.json({ success: true, statuses: [] })

  try {
    const { flights } = await req.json()
    const allowed = new Set([nzDate(0)])
    const wanted = (Array.isArray(flights) ? flights : [])
      .map((f: any) => ({
        bookingRef: String(f?.bookingRef || ''),
        number: normalizeFlightNumber(f?.flightNumber),
        date: String(f?.date || ''),
        branch: String(f?.branch || ''),
      }))
      .filter(f => f.bookingRef && /^[A-Z0-9]{3,8}$/.test(f.number) && allowed.has(f.date))
      .slice(0, 40)

    const statuses = await Promise.all(wanted.map(async f => {
      const airport = Object.entries(BRANCH_AIRPORT).find(([name]) => f.branch.includes(name))?.[1]
      try {
        return { bookingRef: f.bookingRef, ...(await getFlightStatus(f.number, f.date, airport)) }
      } catch (err: any) {
        console.warn('[staff/flight-status]', f.number, err.message)
        return null
      }
    }))
    return NextResponse.json({ success: true, statuses: statuses.filter(Boolean) })
  } catch (err: any) {
    console.error('[staff/flight-status] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
