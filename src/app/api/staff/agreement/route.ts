export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmSignatureList } from '@/lib/rcm-post'
import { requireStaff } from '@/lib/staff-api'

// GET /api/staff/agreement?ref=… → RCM rental agreement link and which signatures are done.
export async function GET(req: NextRequest) {
  const auth = await requireStaff(req, 'agreements.manage')
  if (auth.response) return auth.response

  try {
    const ref = new URL(req.url).searchParams.get('ref')
    if (!ref) return NextResponse.json({ success: false, error: 'ref is required.' }, { status: 400 })

    const slots = await rcmSignatureList(ref)
    const agreement = slots.find(slot => slot.templateId === 0) || slots[0]
    return NextResponse.json({
      success: true,
      agreementUrl: agreement?.agreementUrl || '',
      signatures: slots.map(({ agreementUrl, ...slot }) => slot),
    })
  } catch (err: any) {
    console.error('[staff/agreement] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
