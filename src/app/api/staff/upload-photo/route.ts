export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'
import { requireStaff } from '@/lib/staff-api'

type StoredPhoto = {
  url: string
  storageProvider?: string
  resultsProvider?: string
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function cleanBase64(value: string) {
  return value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
}

function firstString(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && `${value}`.trim() !== '') return `${value}`
  }
  return ''
}

function parseDocumentLinkSetupIds() {
  if (!process.env.RCM_DOCUMENT_LINK_SETUP_IDS) return {}

  try {
    const parsed = JSON.parse(process.env.RCM_DOCUMENT_LINK_SETUP_IDS)
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, number | string> : {}
  } catch {
    console.warn('Invalid RCM_DOCUMENT_LINK_SETUP_IDS JSON; falling back to RCM_DOCUMENT_LINK_SETUP_ID')
    return {}
  }
}

function documentLinkSetupIdFor(photoType: string) {
  const ids = parseDocumentLinkSetupIds()
  const value = ids[photoType] ?? process.env.RCM_DOCUMENT_LINK_SETUP_ID
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function doctypeFor(photoType: string) {
  const type = photoType.toLowerCase()
  if (type.includes('dropoff') || type.includes('return')) return 'DropOff'
  if (type.includes('damage')) return 'Damage'
  if (type.includes('license') || type.includes('document') || type.includes('passport')) return 'DriverLicense'
  return 'PickUp'
}

function normalizeSignUploadResult(result: any) {
  const row = Array.isArray(result) ? result[0] : result
  return {
    signature: firstString(row, ['signature', 'Signature']),
    apiKey: firstString(row, ['api_key', 'apikey', 'apiKey', 'APIKey']) || process.env.RCM_CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY || '',
  }
}

async function uploadToCloudinaryViaRCM(params: {
  reservationRef: string
  photoType: string
  imageBase64: string
  fileName: string
}): Promise<StoredPhoto | null> {
  const cloudName = process.env.RCM_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME
  if (!cloudName) return null

  const bytes = Uint8Array.from(Buffer.from(cleanBase64(params.imageBase64), 'base64'))
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), params.fileName)

  const uploadPreset = process.env.RCM_CLOUDINARY_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESET
  const folder = process.env.RCM_CLOUDINARY_FOLDER || 'yitu-lite'
  const publicId = `${params.reservationRef}/${Date.now()}-${safeFileName(params.photoType)}`

  if (uploadPreset) {
    form.append('upload_preset', uploadPreset)
    form.append('folder', folder)
    form.append('public_id', publicId)
  } else {
    const signedParams = {
      timestamp: `${Math.floor(Date.now() / 1000)}`,
      folder,
      public_id: publicId,
    }
    const signatureResult = await rcmCall('signupload', { params: JSON.stringify(signedParams) })
    const signature = normalizeSignUploadResult(signatureResult)

    if (!signature.signature || !signature.apiKey) {
      throw new Error('RCM signupload did not return a Cloudinary signature/api key. Configure RCM_CLOUDINARY_UPLOAD_PRESET or RCM_CLOUDINARY_API_KEY.')
    }

    Object.entries(signedParams).forEach(([key, value]) => form.append(key, value))
    form.append('api_key', signature.apiKey)
    form.append('signature', signature.signature)
  }

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  })
  const uploadJson = await uploadRes.json()

  if (!uploadRes.ok) {
    throw new Error(`Cloudinary upload failed: ${uploadJson?.error?.message || uploadRes.status}`)
  }

  const url = firstString(uploadJson, ['secure_url', 'url'])
  if (!url) throw new Error('Cloudinary upload did not return a URL')

  return {
    url,
    storageProvider: 'cloudinary.com',
    resultsProvider: JSON.stringify(uploadJson),
  }
}

export async function POST(req: NextRequest) {
  const auth = requireStaff(req)
  if (auth.response) return auth.response

  try {
    const body = await req.json()
    const { reservationRef, photoType, imageBase64, photoUrl } = body
    const fileName = body.fileName || `${photoType || 'photo'}.jpg`

    if (!reservationRef || !photoType || (!imageBase64 && !photoUrl)) {
      return NextResponse.json({ success: false, error: 'reservationRef, photoType and either imageBase64 or photoUrl are required' }, { status: 400 })
    }

    const documentlinksetupid = documentLinkSetupIdFor(photoType)
    if (!documentlinksetupid) {
      return NextResponse.json({
        success: false,
        error: 'RCM_DOCUMENT_LINK_SETUP_ID is not configured. RCM storeupload requires a Document Link Setup ID from RCM System Configuration.',
      }, { status: 500 })
    }

    const storedPhoto = photoUrl
      ? { url: photoUrl, storageProvider: body.storageProvider, resultsProvider: body.resultsProvider }
      : await uploadToCloudinaryViaRCM({ reservationRef, photoType, imageBase64, fileName })

    if (!storedPhoto?.url) {
      return NextResponse.json({
        success: false,
        error: 'RCM storeupload requires a public document URL. Configure RCM Cloudinary settings or send photoUrl from an external storage provider.',
      }, { status: 500 })
    }

    const result = await rcmCall(process.env.RCM_PHOTO_UPLOAD_METHOD || 'storeupload', {
      documentlinksetupid,
      url: storedPhoto.url,
      doctype: body.doctype || doctypeFor(photoType),
      source: 'YITU Lite',
      reservationref: reservationRef,
      description: body.description || photoType,
      notes: body.notes || `Uploaded by ${auth.payload?.staffId || 'staff'} from YITU Lite`,
      originalname: fileName,
      storageprovider: storedPhoto.storageProvider || body.storageProvider || '',
      resultsprovider: storedPhoto.resultsProvider || body.resultsProvider || '',
      istaggedincloudinary: storedPhoto.storageProvider === 'cloudinary.com',
    })

    return NextResponse.json({
      success: true,
      photoId: `${reservationRef}-${photoType}-${Date.now()}`,
      url: storedPhoto.url,
      data: result,
    })
  } catch (err: any) {
    console.error('[staff/upload-photo] error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
