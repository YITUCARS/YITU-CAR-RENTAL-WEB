export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { findCheckin, updateCheckin } from '@/lib/online-checkin'
import { fileKind, NoDocumentSlotError, uploadDocumentToRcm } from '@/lib/rcm-documents'

// POST /api/checkin/[token]/file  Body: { key, data (base64 / data URL of a JPEG or PDF) }
// One online check-in document, stored straight in the booking's RCM documents. Sent as soon as
// the hirer picks it, one per request, so large PDFs stay well under the request size limit.

const FILE_TYPES = {
  licenseFront: 'document-checkin-license-front',
  licenseBack: 'document-checkin-license-back',
  passport: 'document-checkin-passport',
  translation: 'document-checkin-translation',
} as const
type FileKey = keyof typeof FILE_TYPES

/** 10 MB file ≈ 13.4 M base64 characters. */
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const row = await findCheckin(params.token)
  if (!row) {
    return NextResponse.json({ success: false, error: 'This check-in link has expired or been replaced. Please contact YITU Car Rental.' }, { status: 404 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 }) }
  const key = String(body?.key || '') as FileKey
  const data = typeof body?.data === 'string' ? body.data : ''
  if (!(key in FILE_TYPES) || !data) return NextResponse.json({ success: false, error: 'Invalid file.' }, { status: 400 })

  const bytes = Buffer.from(data.replace(/^data:[a-zA-Z0-9.+/-]+;base64,/, ''), 'base64')
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
  if (!bytes.length || (!isJpeg && fileKind(bytes).ext !== 'pdf')) {
    return NextResponse.json({ success: false, error: 'Please upload a photo or a PDF.' }, { status: 415 })
  }
  if (bytes.length > MAX_BYTES) return NextResponse.json({ success: false, error: 'File is larger than 10 MB.' }, { status: 413 })

  try {
    await uploadDocumentToRcm({
      reservationRef: row.booking_ref,
      photoType: FILE_TYPES[key],
      imageBase64: data,
      source: 'YITU Online Check-in',
      notes: `Uploaded by the hirer in online check-in (${key})`,
    })
    // Re-read so two files uploading at once don't overwrite each other's entry.
    const latest = await findCheckin(params.token)
    const photos = Array.from(new Set([...(latest?.photos || row.photos), key]))
    await updateCheckin(row.id, { photos })
    console.log('[checkin] file uploaded', row.booking_ref, key, fileKind(bytes).ext)
    return NextResponse.json({ success: true, photos })
  } catch (err: any) {
    console.error('[checkin] file upload failed:', row.booking_ref, key, err.message)
    const message = err instanceof NoDocumentSlotError
      ? 'We could not attach files to this booking. Please bring your documents to the counter.'
      : 'The file could not be uploaded. Please check your connection and try again.'
    return NextResponse.json({ success: false, error: message }, { status: 502 })
  }
}
