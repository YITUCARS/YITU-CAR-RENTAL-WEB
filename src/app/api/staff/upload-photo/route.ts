export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmPostBooking } from '@/lib/rcm-post'
import { requireStaff } from '@/lib/staff-api'

// POST /api/staff/upload-photo
// Body: { reservationRef, photoType, imageBase64, fileName? }
//
// RCM Post Booking document upload (support.rentalcarmanager.com → "Post Booking API Process"):
//   1. documentlist  → which document types (documentlinksetupid) the booking accepts
//   2. signupload    → RCM signs the Cloudinary upload params
//   3. upload to RCM's Cloudinary account
//   4. storeupload   → records the Cloudinary URL against the reservation
//
// Every photo goes to the "checkin" workflow's document slot from documentlist (it accepts any
// number of files; the file name says which photo it is). A dedicated Document Link Setup ID can
// still be mapped per photo-type prefix in RCM_DOCUMENT_LINK_SETUP_IDS, e.g.
//   {"pickup-vehicle":5,"dropoff-vehicle":6,"pickup-damage":7,"dropoff-damage":8}

// RCM's shared Cloudinary account, from RCM's sample widget code. Uploads must be signed by RCM.
const CLOUDINARY = {
  cloudName: process.env.RCM_CLOUDINARY_CLOUD_NAME || 'rentalcarmanager',
  apiKey: process.env.RCM_CLOUDINARY_API_KEY || '128229988586749',
  uploadPreset: process.env.RCM_CLOUDINARY_UPLOAD_PRESET || 'hsfepzh0',
  // RCM tags uploads with the company's database name (see bookinginfo.urlpathfordocuments).
  tag: process.env.RCM_CLOUDINARY_TAG || 'nzyitucarrentallimited838',
}

type UploadTarget = { documentlinksetupid: number; customerid?: number }

function cleanBase64(value: string) {
  return value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
}

function isDriverDocument(photoType: string) {
  return /licen[cs]e|passport|document/i.test(photoType)
}

function doctypeFor(photoType: string) {
  const type = photoType.toLowerCase()
  if (isDriverDocument(type)) return 'DriverLicense'
  if (type.includes('damage')) return 'Damage'
  if (type.includes('dropoff') || type.includes('return')) return 'DropOff'
  return 'PickUp'
}

function configuredSetupIds(): Record<string, number> {
  try {
    const parsed = JSON.parse(process.env.RCM_DOCUMENT_LINK_SETUP_IDS || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    console.warn('[staff/upload-photo] invalid RCM_DOCUMENT_LINK_SETUP_IDS JSON')
    return {}
  }
}

async function resolveTarget(reservationRef: string, photoType: string): Promise<UploadTarget | null> {
  if (!isDriverDocument(photoType)) {
    const ids = configuredSetupIds()
    const prefix = Object.keys(ids)
      .sort((a, b) => b.length - a.length)
      .find(key => photoType.startsWith(key))
    const id = prefix ? Number(ids[prefix]) : NaN
    if (Number.isFinite(id) && id > 0) return { documentlinksetupid: id }
  }

  // Primary driver's document slot from the online check-in workflow.
  const docs = await rcmPostBooking('documentlist', { reservationref: reservationRef, workflowcode: 'checkin' })
  const rows: any[] = Array.isArray(docs) ? docs : []
  const slot = rows.find(row => row.isprimary && !row.isvehicleupload) || rows.find(row => !row.isvehicleupload)
  return slot ? { documentlinksetupid: Number(slot.documentlinksetupid), customerid: Number(slot.customerid) } : null
}

async function uploadToRcmCloudinary(imageBase64: string, fileName: string) {
  const params = {
    timestamp: Math.floor(Date.now() / 1000),
    upload_preset: CLOUDINARY.uploadPreset,
    tags: CLOUDINARY.tag,
  }
  const signed = await rcmPostBooking('signupload', { params })
  const signature = signed?.signature
  if (!signature) throw new Error('RCM signupload did not return a signature.')

  const form = new FormData()
  form.append('file', new Blob([Buffer.from(cleanBase64(imageBase64), 'base64')], { type: 'image/jpeg' }), fileName)
  Object.entries(params).forEach(([key, value]) => form.append(key, String(value)))
  form.append('api_key', CLOUDINARY.apiKey)
  form.append('signature', signature)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`, { method: 'POST', body: form })
  const json = await res.json()
  if (!res.ok || !json.secure_url) throw new Error(`Cloudinary upload failed: ${json?.error?.message || res.status}`)
  return json
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, 'photos.upload')
  if (auth.response) return auth.response

  try {
    const { reservationRef, photoType, imageBase64 } = await req.json()
    const fileName = `${reservationRef}-${photoType}.jpg`.replace(/[^a-zA-Z0-9._-]/g, '_')

    if (!reservationRef || !photoType || !imageBase64) {
      return NextResponse.json({ success: false, error: 'reservationRef, photoType and imageBase64 are required.' }, { status: 400 })
    }

    // Resolve the RCM document slot first so nothing is uploaded that RCM can't link.
    const target = await resolveTarget(reservationRef, photoType)
    if (!target) {
      return NextResponse.json({
        success: false,
        error: `RCM has no document slot for this booking ("${photoType}").`,
      }, { status: 501 })
    }

    const uploaded = await uploadToRcmCloudinary(imageBase64, fileName)

    const store = (doctype: string) => rcmPostBooking('storeupload', {
      documentlinksetupid: target.documentlinksetupid,
      url: uploaded.secure_url,
      doctype,
      source: 'YITU Lite',
      reservationref: reservationRef,
      ...(target.customerid ? { customerid: target.customerid } : {}),
      originalname: fileName,
      storageprovider: 'cloudinary.com',
      resultsprovider: JSON.stringify(uploaded),
      notes: `Uploaded by ${auth.payload?.staffId || 'staff'} from YITU Lite (${photoType})`,
    })
    // The check-in slot is a licence slot; if RCM refuses another doc type there, store it as one.
    const doctype = doctypeFor(photoType)
    const result = await store(doctype).catch(err => {
      if (doctype === 'DriverLicense') throw err
      console.warn('[staff/upload-photo] storeupload as', doctype, 'failed, retrying as DriverLicense:', err.message)
      return store('DriverLicense')
    })

    return NextResponse.json({
      success: true,
      photoId: uploaded.public_id,
      url: uploaded.secure_url,
      data: result,
    })
  } catch (err: any) {
    console.error('[staff/upload-photo] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
