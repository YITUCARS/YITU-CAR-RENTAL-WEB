export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmStep3, toRCMDate, LOCATION_IDS } from '@/lib/rcm'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            vehicleCategoryTypeId,
            vehicleCategoryId,
            pickupLocation,
            dropoffLocation,
            pickupDate,
            dropoffDate,
            pickupTime,
            dropoffTime,
            promoCode,
        } = body

        const results = await rcmStep3({
            vehicleCategoryTypeId,
            vehicleCategoryId,
            pickupLocationId: LOCATION_IDS[pickupLocation] || 1,
            dropoffLocationId: LOCATION_IDS[dropoffLocation] || 1,
            pickupDate: toRCMDate(pickupDate),
            pickupTime: pickupTime || '10:00',
            dropoffDate: toRCMDate(dropoffDate),
            dropoffTime: dropoffTime || '10:00',
            campaignCode: promoCode || '',
        })

        return NextResponse.json({ success: true, data: results })
    } catch (err: any) {
        console.error('RCM step3 error:', err.message)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
