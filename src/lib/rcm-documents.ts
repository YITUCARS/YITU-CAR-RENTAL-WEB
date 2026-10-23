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
// Used by YITU Lite (staff/upload-photo) and the hirer's online check-in.

import { rcmPostBooking } from '@/lib/rcm-post'

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
    console.warn('[rcm-documents] invalid RCM_DOCUMENT_LINK_SETUP_IDS JSON')
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

/**
 * Uploads one photo to the booking's RCM documents. Throws a NoDocumentSlotError when RCM has
 * nowhere to link it (checked before anything is uploaded).
 */
export async function uploadDocumentToRcm(params: {
  reservationRef: string
  photoType: string
  imageBase64: string
  source: string
  notes: string
}) {
  const { reservationRef, photoType, imageBase64 } = params
  const fileName = `${reservationRef}-${photoType}.jpg`.replace(/[^a-zA-Z0-9._-]/g, '_')

  // Resolve the RCM document slot first so nothing is uploaded that RCM can't link.
  const target = await resolveTarget(reservationRef, photoType)
  if (!target) throw new NoDocumentSlotError(`RCM has no document slot for this booking ("${photoType}").`)

  const uploaded = await uploadToRcmCloudinary(imageBase64, fileName)

  const store = (doctype: string) => rcmPostBooking('storeupload', {
    documentlinksetupid: target.documentlinksetupid,
    url: uploaded.secure_url,
    doctype,
    source: params.source,
    reservationref: reservationRef,
    ...(target.customerid ? { customerid: target.customerid } : {}),
    originalname: fileName,
    storageprovider: 'cloudinary.com',
    resultsprovider: JSON.stringify(uploaded),
    notes: params.notes,
  })
  // The check-in slot is a licence slot; if RCM refuses another doc type there, store it as one.
  const doctype = doctypeFor(photoType)
  const result = await store(doctype).catch(err => {
    if (doctype === 'DriverLicense') throw err
    console.warn('[rcm-documents] storeupload as', doctype, 'failed, retrying as DriverLicense:', err.message)
    return store('DriverLicense')
  })
  return { photoId: String(uploaded.public_id), url: String(uploaded.secure_url), data: result }
}

export class NoDocumentSlotError extends Error {}
