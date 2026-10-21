export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { fullSync, incrementalSync } from '@/lib/rcm-sync'

// GET /api/cron/rcm-sync                 → incremental (server cron, every 5 minutes)
// GET /api/cron/rcm-sync?mode=full       → today-7 … today+90 (server cron, nightly)
// Authorization: Bearer <CRON_SECRET>

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function nzToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date())
}

function shift(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const today = nzToday()
  const job = searchParams.get('mode') === 'full'
    ? fullSync(searchParams.get('from') || shift(today, -7), searchParams.get('to') || shift(today, 90))
    : incrementalSync()

  try {
    const result = await job
    console.log('[cron/rcm-sync]', JSON.stringify(result))
    return NextResponse.json({ success: true, ...(result as object) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron/rcm-sync] error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
