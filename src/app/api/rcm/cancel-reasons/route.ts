export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

export async function POST() {
  try {
    const result = await rcmCall('cancelreasons', {})
    // result may be an array or { reasons: [...] }
    const reasons = Array.isArray(result) ? result : (result?.reasons ?? result?.cancelreasons ?? [])
    return NextResponse.json({ success: true, reasons })
  } catch (err: any) {
    console.error('[cancel-reasons] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
