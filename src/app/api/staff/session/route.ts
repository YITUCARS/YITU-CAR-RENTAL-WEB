export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  getCurrentStaffIdentity,
  issueStaffToken,
  verifyRefreshableStaffToken,
} from '@/lib/staff-api'

// POST /api/staff/session
// Renews a locally remembered session. An expired token is accepted only when its signature is
// intact; the account is then re-read from Supabase so disabled/deleted accounts cannot renew.
export async function POST(req: NextRequest) {
  try {
    const previous = verifyRefreshableStaffToken(req.headers.get('x-staff-token'))
    if (!previous) {
      return NextResponse.json(
        { success: false, code: 'TOKEN_INVALID', error: 'This device session is no longer valid.' },
        { status: 401 }
      )
    }

    const staff = await getCurrentStaffIdentity(previous.staffId)
    if (!staff) {
      return NextResponse.json(
        { success: false, code: 'ACCOUNT_INACTIVE', error: 'This staff account is disabled or no longer exists.' },
        { status: 401 }
      )
    }

    return NextResponse.json({ success: true, token: issueStaffToken(staff), staff })
  } catch (error: any) {
    console.error('[staff/session] renewal failed:', error.message)
    return NextResponse.json(
      { success: false, code: 'SESSION_TEMPORARILY_UNAVAILABLE', error: 'Session renewal is temporarily unavailable.' },
      { status: 503 }
    )
  }
}
