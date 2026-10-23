export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { scanLicence } from '@/lib/licence-ocr'
import { requireStaff } from '@/lib/staff-api'

/** Per photo, after base64 decoding. */
const MAX_BYTES = 10 * 1024 * 1024

function decode(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  const bytes = Buffer.from(value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ''), 'base64')
  return bytes.length ? bytes : null
}

// POST /api/staff/licence-scan  Body: { front: base64, back?: base64 }
// Reads a driver licence photo into licence fields. Nothing is stored and no personal data is logged.
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, 'pickup.manage')
  if (auth.response) return auth.response

  try {
    const { front, back } = await req.json()
    const frontBytes = decode(front)
    const backBytes = decode(back)
    if (!frontBytes) return NextResponse.json({ success: false, error: 'Add a photo of the licence.' }, { status: 400 })
    if (frontBytes.length > MAX_BYTES || (backBytes?.length ?? 0) > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'Photo is too large.' }, { status: 413 })
    }

    const started = Date.now()
    const scan = await scanLicence(frontBytes, backBytes)
    console.log('[staff/licence-scan]', scan.documentType, scan.issues.join(',') || 'ok', `${Date.now() - started}ms`, 'by', auth.payload?.staffId)
    return NextResponse.json({ success: true, scan })
  } catch (err: any) {
    console.error('[staff/licence-scan] error:', err.name, err.message)
    return NextResponse.json({ success: false, error: 'Could not read the licence. Please enter the details by hand.' }, { status: 502 })
  }
}
