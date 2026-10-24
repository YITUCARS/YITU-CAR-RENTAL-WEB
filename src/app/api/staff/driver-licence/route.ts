export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmUpdateDriverLicence } from '@/lib/rcm-post'
import { requireStaff } from '@/lib/staff-api'

// POST /api/staff/driver-licence
// Body: { reservationRef, licenseNo, licenseExpires?, licenseIssued?, dateOfBirth?, phone?, email? }
// Saves the primary driver's licence (and date of birth / contact details) in RCM so they appear
// on the rental agreement. Dates are YYYY-MM-DD.
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, 'pickup.manage')
  if (auth.response) return auth.response

  let ref = ''
  try {
    const { reservationRef, licenseNo, licenseExpires, licenseIssued, dateOfBirth, phone, email } = await req.json()
    ref = String(reservationRef || '')
    if (!reservationRef || !String(licenseNo || '').trim()) {
      return NextResponse.json({ success: false, error: 'reservationRef and licenseNo are required.' }, { status: 400 })
    }
    const saved = await rcmUpdateDriverLicence({
      reservationRef: String(reservationRef),
      licenseNo: String(licenseNo).trim(),
      licenseExpires: licenseExpires ? String(licenseExpires) : undefined,
      licenseIssued: licenseIssued ? String(licenseIssued) : undefined,
      dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(String(dateOfBirth || '')) ? String(dateOfBirth) : undefined,
      phone: phone ? String(phone) : undefined,
      email: email ? String(email) : undefined,
    })
    console.log('[staff/driver-licence]', reservationRef, 'updated by', auth.payload?.staffId)
    return NextResponse.json({ success: true, ...saved })
  } catch (err: any) {
    console.error('[staff/driver-licence] error:', ref, err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
