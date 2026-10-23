export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { NoDocumentSlotError, uploadDocumentToRcm } from '@/lib/rcm-documents'
import { requireStaff } from '@/lib/staff-api'

// POST /api/staff/upload-photo
// Body: { reservationRef, photoType, imageBase64, fileName? }
// Stores the photo in the booking's RCM documents (see lib/rcm-documents.ts).
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, 'photos.upload')
  if (auth.response) return auth.response

  try {
    const { reservationRef, photoType, imageBase64 } = await req.json()
    if (!reservationRef || !photoType || !imageBase64) {
      return NextResponse.json({ success: false, error: 'reservationRef, photoType and imageBase64 are required.' }, { status: 400 })
    }

    const uploaded = await uploadDocumentToRcm({
      reservationRef, photoType, imageBase64,
      source: 'YITU Lite',
      notes: `Uploaded by ${auth.payload?.staffId || 'staff'} from YITU Lite (${photoType})`,
    })
    return NextResponse.json({ success: true, ...uploaded })
  } catch (err: any) {
    if (err instanceof NoDocumentSlotError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 501 })
    }
    console.error('[staff/upload-photo] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
