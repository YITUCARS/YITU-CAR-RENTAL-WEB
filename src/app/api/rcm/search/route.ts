export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmSearch, toRCMDate, LOCATION_IDS } from '@/lib/rcm'
import { resolveRcmPromoCode } from '@/lib/promo-code'
import { applyLocalPrices, calculateRentalDays } from '@/lib/local-pricing'
import { getCachedRcmSearch, getStaleRcmSearch, mergeRcmVehiclesWithCache, saveRcmSearch, saveRcmVehicles } from '@/lib/rcm-vehicle-cache'

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
    const rcmPromoCode = resolveRcmPromoCode(promoCode)
    const cacheKey = JSON.stringify({ pickupLocation, dropoffLocation, pickupDate, dropoffDate, pickupTime, dropoffTime, promoCode })
    const now = Date.now()
    const cached = searchCache.get(cacheKey)

    async function addLocalPricing(data: any) {
        const rentalDays = calculateRentalDays(pickupDate, pickupTime || '10:00', dropoffDate, dropoffTime || '10:00')
        const local = await applyLocalPrices(data, { pickupDate, rentalDays })
        return { ...local, rentalDays }
    }


    if (cached && now - cached.timestamp < CACHE_TTL) {
        const priced = await addLocalPricing(cached.data?.availablecars || [])
        return NextResponse.json({ success: true, data: { ...cached.data, availablecars: priced.vehicles }, pricing: { mode: priced.mode, matched: priced.matched } }, {
            headers: { 'Cache-Control': 'public, max-age=300' },
        })
    }

    const persistentCached = await getCachedRcmSearch(cacheKey, 2 * 60 * 1000)
    if (persistentCached) {
        searchCache.set(cacheKey, { data: persistentCached, timestamp: now })
        const priced = await addLocalPricing(persistentCached?.availablecars || [])
        return NextResponse.json({ success: true, data: { ...persistentCached, availablecars: priced.vehicles }, pricing: { mode: priced.mode, matched: priced.matched }, source: 'local-cache' }, {
            headers: { 'Cache-Control': 'public, max-age=120' },
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
            campaignCode: rcmPromoCode,
        })

        if (promoCode) {
            const sample = results?.availablecars?.[0]
            console.log('[RCM search] public code:', promoCode, '| campaignCode:', rcmPromoCode, '| sample vehicle discount fields:', {
                avgrate: sample?.avgrate,
                totalrateafterdiscount: sample?.totalrateafterdiscount,
                totaldiscountamount: sample?.totaldiscountamount,
            })
        }

        const liveVehicles = results?.availablecars ?? []
        await saveRcmVehicles(liveVehicles)
        const mergedResults = {
            ...results,
            availablecars: await mergeRcmVehiclesWithCache(liveVehicles),
        }
        const priced = await addLocalPricing(mergedResults.availablecars)
        const finalResults = { ...mergedResults, availablecars: priced.vehicles }
        await saveRcmSearch(cacheKey, finalResults)
        searchCache.set(cacheKey, { data: finalResults, timestamp: now })

        return NextResponse.json({ success: true, data: finalResults, pricing: { mode: priced.mode, matched: priced.matched } }, {
            headers: { 'Cache-Control': 'public, max-age=300' },
        })
    } catch (err: any) {
        console.error('RCM search error:', err.message)

        const stalePersistent = await getStaleRcmSearch(cacheKey)
        if (stalePersistent) {
            return NextResponse.json({ success: true, data: stalePersistent, source: 'stale-local-cache' }, {
                headers: { 'Cache-Control': 'no-store' },
            })
        }

        if (cached) {
            return NextResponse.json({ success: true, data: cached.data }, {
                headers: { 'Cache-Control': 'public, max-age=300' },
            })
        }

        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
