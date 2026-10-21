export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmSaveSignature, rcmSignatureList } from '@/lib/rcm-post'
import { requireStaff } from '@/lib/staff-api'

// POST /api/staff/signature
// Body: { reservationRef: string, signatureJson: string }  (jquery.signature.js format)
// Saves the hirer's signature on RCM's default agreement template (id 0). RCM then renders the
// rental agreement with the signature, available at the returned agreementUrl.
// Other templates (e.g. extra terms) are left for the hirer to sign, because the app
// doesn't show their text.
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, 'agreements.manage')
  if (auth.response) return auth.response

  try {
    const { reservationRef, signatureJson } = await req.json()
    if (!reservationRef || !signatureJson) {
      return NextResponse.json({ success: false, error: 'reservationRef and signatureJson are required.' }, { status: 400 })
    }

    await rcmSaveSignature({
      reservationRef,
      templateId: 0,
      signatureJson: typeof signatureJson === 'string' ? signatureJson : JSON.stringify(signatureJson),
    })

    const slots = await rcmSignatureList(reservationRef)
    const agreement = slots.find(slot => slot.templateId === 0) || slots[0]
    return NextResponse.json({
      success: true,
      agreementUrl: agreement?.agreementUrl || '',
      signatures: slots.map(({ agreementUrl, ...slot }) => slot),
    })
  } catch (err: any) {
    console.error('[staff/signature] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
