export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall, toRCMDate } from '@/lib/rcm'

function normalizePhoneForRcm(phone: string) {
  const display = (phone || '').trim().replace(/\s+/g, '')
  const numeric = display.replace(/\D/g, '')
  return {
    display,
    numeric,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      pickupDate, pickupTime,
      dropoffDate, dropoffTime,
      pickupLocationId, dropoffLocationId,
      vehicleCategoryId, vehicleCategoryTypeId,
      firstName, lastName,
      email, phone,
      flightNumber, notes,
      selectedInsuranceId,
      extras,
      driverAge,
      promoCode,
      mandatoryFeeIds,
    } = body

    console.log('[create-booking FULL BODY]\n', JSON.stringify(body, null, 2))

    const ageid = driverAge === 'under26' ? 4 : 9
    const customerPhone = normalizePhoneForRcm(phone || '')

    // Build optionalfees array from extras map { "18": 2, "22": 1 }
    const optionalFeesList: { id: number; qty: number }[] = Object.entries(extras || {})
      .filter(([, qty]) => Number(qty) > 0)
      .map(([id, qty]) => ({ id: Number(id), qty: Number(qty) }))

    // Young driver fee (RCM extra id=15) is mandatory for under-26 drivers
    const YOUNG_DRIVER_FEE_ID = 15
    if (driverAge === 'under26' && !optionalFeesList.find(f => f.id === YOUNG_DRIVER_FEE_ID)) {
      optionalFeesList.push({ id: YOUNG_DRIVER_FEE_ID, qty: 1 })
    }

    const result = await rcmCall('booking', {
      vehiclecategorytypeid: vehicleCategoryTypeId || 0,
      pickuplocationid: pickupLocationId,
      pickupdate: toRCMDate(pickupDate),
      pickuptime: pickupTime || '10:00',
      dropofflocationid: dropoffLocationId,
      dropoffdate: toRCMDate(dropoffDate),
      dropofftime: dropoffTime || '10:00',
      ageid,
      vehiclecategoryid: vehicleCategoryId,
      bookingtype: 2,
      insuranceid: selectedInsuranceId || 0,
      extrakmsid: 0,
      transmission: 1,
      numbertravelling: 1,
      campaigncode: promoCode || '',
      ...(optionalFeesList.length > 0 ? { optionalfees: optionalFeesList } : {}),
      ...((mandatoryFeeIds || []).length > 0 ? {
        mandatoryfees: (mandatoryFeeIds as number[]).map((id: number) => ({ id, qty: 1 }))
      } : {}),
      customer: {
        firstname: firstName,
        lastname: lastName,
        email,
        phone: customerPhone.numeric,
        mobile: customerPhone.numeric,
        phone1: customerPhone.numeric,
        phone2: customerPhone.numeric,
        phn: customerPhone.numeric,
        mob: customerPhone.numeric,
        dateofbirth: '',
        licenseno: '',
        state: '',
        city: '',
        postcode: '',
        address: '',
      },
      flightin: flightNumber || '',
      remark: [customerPhone.numeric ? `Phone: ${customerPhone.numeric}` : '', notes || ''].filter(Boolean).join(' | '),
    })

    console.log('[create-booking] RCM result keys:', Object.keys(result || {}))
    console.log('[create-booking] RCM result:', JSON.stringify(result, null, 2))

    return NextResponse.json({
      success: true,
      reservationRef: result?.reservationref,
      reservationNo: result?.reservationno,
      data: result,
    })
  } catch (err: any) {
    console.error('RCM booking error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
