export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmSearch, toRCMDate, LOCATION_IDS } from '@/lib/rcm'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { pickupLocation, dropoffLocation, pickupDate, dropoffDate, pickupTime, dropoffTime, promoCode } = body

        const results = await rcmSearch({
            pickupLocationId: LOCATION_IDS[pickupLocation] || 1,
            dropoffLocationId: LOCATION_IDS[dropoffLocation] || 1,
            pickupDate: toRCMDate(pickupDate),
            pickupTime: pickupTime || '10:00',
            dropoffDate: toRCMDate(dropoffDate),
            dropoffTime: dropoffTime || '10:00',
            campaignCode: promoCode || '',
        })

        if (promoCode) {
            const sample = results?.availablecars?.[0]
            console.log('[RCM search] campaignCode:', promoCode, '| sample vehicle discount fields:', {
                avgrate: sample?.avgrate,
                totalrateafterdiscount: sample?.totalrateafterdiscount,
                totaldiscountamount: sample?.totaldiscountamount,
            })
        }
        return NextResponse.json({ success: true, data: results })
    } catch (err: any) {
        console.error('RCM search error:', err.message)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
