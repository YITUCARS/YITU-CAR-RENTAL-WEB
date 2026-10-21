export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getLocationNames, requireStaff, staffCanSeeBranch } from '@/lib/staff-api'

// GET /api/staff/branches → RCM locations for the YITU Lite branch filter.
export async function GET(req: NextRequest) {
  const auth = await requireStaff(req, 'bookings.read')
  if (auth.response) return auth.response

  try {
    const names = await getLocationNames()
    const branches = Array.from(names, ([id, name]) => ({ id, name })).filter(branch => branch.name && staffCanSeeBranch(auth.payload, branch.name))
    return NextResponse.json({ success: true, branches })
  } catch (err: any) {
    console.error('[staff/branches] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
