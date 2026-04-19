export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmSearch, toRCMDate, LOCATION_IDS } from '@/lib/rcm'

type CacheEntry = { data: any; timestamp: number }
const searchCache = new Map<string, CacheEntry>()
const CACHE_TTL = 300 * 1000 // 5 minutes

export async function POST(req: NextRequest) {
    let body: any
    try {
        body = await req.json()
    } catch (err: any) {
        return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    const { pickupLocation, dropoffLocation, pickupDate, dropoffDate, pickupTime, dropoffTime, promoCode } = body
    const cacheKey = JSON.stringify({ pickupLocation, dropoffLocation, pickupDate, dropoffDate, pickupTime, dropoffTime, promoCode })
    const now = Date.now()
    const cached = searchCache.get(cacheKey)

    if (cached && now - cached.timestamp < CACHE_TTL) {
        return NextResponse.json({ success: true, data: cached.data }, {
            headers: { 'Cache-Control': 'public, max-age=300' },
        })
    }

    try {
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

        searchCache.set(cacheKey, { data: results, timestamp: now })

        return NextResponse.json({ success: true, data: results }, {
            headers: { 'Cache-Control': 'public, max-age=300' },
        })
    } catch (err: any) {
        console.error('RCM search error:', err.message)

        if (cached) {
            return NextResponse.json({ success: true, data: cached.data }, {
                headers: { 'Cache-Control': 'public, max-age=300' },
            })
        }

        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
