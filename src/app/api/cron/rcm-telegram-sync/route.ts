export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { syncRcmBookingsToTelegram } from '@/lib/rcm-telegram'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncRcmBookingsToTelegram()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron/rcm-telegram-sync] error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
