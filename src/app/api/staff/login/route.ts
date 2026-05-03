export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { findStaffUser, issueStaffToken } from '@/lib/staff-api'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const staffId = String(body.staffId || body.username || '')
    const password = String(body.password || '')
    const user = findStaffUser(staffId, password)

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid staff ID or password' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      token: issueStaffToken(user.id, user.name),
      staff: {
        id: user.id,
        name: user.name || user.id,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
