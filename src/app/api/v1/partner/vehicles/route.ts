import { NextRequest, NextResponse } from 'next/server'
import { getCachedRcmVehicles } from '@/lib/rcm-vehicle-cache'
import { partnerAuth, partnerError } from '@/lib/partner-api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = partnerAuth(req)
  if (denied) return denied
  try {
    const cached = await getCachedRcmVehicles()
    return NextResponse.json({ success: true, data: cached.vehicles, source: 'local-cache', syncedAt: cached.syncedAt })
  } catch (error) {
    return partnerError(error)
  }
}
