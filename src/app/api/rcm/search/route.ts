export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmSearch, toRCMDate, LOCATION_IDS } from '@/lib/rcm'
import { resolveRcmPromoCode } from '@/lib/promo-code'
import { applyLocalPrices, calculateRentalDays } from '@/lib/local-pricing'
import { hoursUntilNz, msToNzLocal, nzLocalToMs } from '@/lib/nz-time'
import { getCachedRcmSearch, getCachedRcmVehicles, getStaleRcmSearch, mergeRcmVehiclesWithCache, saveRcmSearch, saveRcmVehicles } from '@/lib/rcm-vehicle-cache'
import { readPartnerSession } from '@/lib/partner-auth'

type CacheEntry = { data: any; timestamp: number }
const searchCache = new Map<string, CacheEntry>()
const CACHE_TTL = 300 * 1000 // 5 minutes

function hasRcmPrice(vehicle: any) {
    return [vehicle.avgrate, vehicle.discounteddailyrate, vehicle.totalrateafterdiscount, vehicle.totalratebeforediscount]
        .some(value => Number(value) > 0)
}

// RCM refuses to quote a pick-up before the branch next opens (e.g. a search
// at 19:30 for 02:00–08:00 tomorrow): every row comes back with no rate and no
// availability message. Genuinely booked-out rows carry a message instead.
function isRcmQuoteRefused(vehicles: any[]) {
    return vehicles.length > 0 && vehicles.every(vehicle =>
        !hasRcmPrice(vehicle) && !String(vehicle.availablemessage || '').trim()
    )
}

const MANUAL_REQUEST_MESSAGE = 'Request booking - human confirmation required'

function isRcmAvailable(vehicle: any) {
    return vehicle.available === 1 || String(vehicle.availablemessage || '').trim().toLowerCase() === 'available'
}

// The next 09:00 NZ time, when RCM is quoting normally again.
function nextNzNineAm() {
    const todayNineAm = nzLocalToMs(msToNzLocal(Date.now()).date, '09:00')
    if (todayNineAm > Date.now()) return todayNineAm
    return nzLocalToMs(msToNzLocal(todayNineAm + 24 * 36e5).date, '09:00')
}

function filterVehiclesForPickup(vehicles: any[], pickupLocation: string) {
    // Christchurch remains the catalogue view: it includes booked-out rows so
    // customers can ask for the next available date. RCM has no vehicle-level
    // branch id, but a Queenstown quote has a real rate only when RCM can price
    // that category for the selected Queenstown search.
    if (pickupLocation !== 'Queenstown') return vehicles
    return vehicles.filter(hasRcmPrice)
}

export async function POST(req: NextRequest) {
    let body: any
    try {
        body = await req.json()
    } catch (err: any) {
        return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    const { pickupLocation, dropoffLocation, pickupDate, dropoffDate, pickupTime, dropoffTime, promoCode, shortNotice = false } = body
    const partnerSession = readPartnerSession(req)
    const partnerDiscount = Math.min(100, Math.max(0, Number(partnerSession?.discountPercent || 0)))
    const rcmPromoCode = resolveRcmPromoCode(promoCode)
    const cacheKey = JSON.stringify({ pickupLocation, dropoffLocation, pickupDate, dropoffDate, pickupTime, dropoffTime, promoCode })
    const now = Date.now()
    const cached = searchCache.get(cacheKey)
    // Queenstown must be filtered from the current RCM quote. Reusing a
    // merged local-price search cache could turn a zero RCM rate into a priced
    // vehicle before the location filter runs.
    const canUseSearchCache = pickupLocation !== 'Queenstown' && partnerDiscount === 0

    function applyPartnerDiscount(vehicles: any[]) {
        if (!partnerDiscount) return vehicles
        return vehicles.map(vehicle => {
            const original = Number(vehicle.localPricingPreview?.avgrate || vehicle.localPricePerDay || vehicle.avgrate || 0)
            if (!Number.isFinite(original) || original <= 0) return vehicle
            const discounted = Math.round(original * (1 - partnerDiscount / 100) * 100) / 100
            const originalTotal = Number(vehicle.localPricingPreview?.totalratebeforediscount || vehicle.totalratebeforediscount || original)
            const discountedTotal = Math.round(originalTotal * (1 - partnerDiscount / 100) * 100) / 100
            const pricing = vehicle.localPricingPreview ? { ...vehicle.localPricingPreview, avgrate: discounted, totalrateafterdiscount: discountedTotal, partnerOriginalPrice: original, partnerDiscountPercent: partnerDiscount } : null
            return { ...vehicle, avgrate: discounted, totalratebeforediscount: originalTotal, totalrateafterdiscount: discountedTotal, totaldiscountamount: Math.round((originalTotal - discountedTotal) * 100) / 100, partnerOriginalPrice: original, partnerDiscountPercent: partnerDiscount, ...(pricing ? { localPricingPreview: pricing } : {}) }
        })
    }

    async function addLocalPricing(data: any) {
        const rentalDays = calculateRentalDays(pickupDate, pickupTime || '10:00', dropoffDate, dropoffTime || '10:00')
        const local = await applyLocalPrices(data, { pickupDate, rentalDays })
        return { ...local, rentalDays }
    }


    if (canUseSearchCache && cached && now - cached.timestamp < CACHE_TTL) {
        const merged = await mergeRcmVehiclesWithCache(cached.data?.availablecars || [])
        const refreshedVehicles = filterVehiclesForPickup(merged, pickupLocation)
        const priced = await addLocalPricing(refreshedVehicles)
        return NextResponse.json({ success: true, partnerDiscount, data: { ...cached.data, availablecars: applyPartnerDiscount(priced.vehicles) }, pricing: { mode: priced.mode, matched: priced.matched } }, {
            headers: { 'Cache-Control': 'public, max-age=300' },
        })
    }

    const persistentCached = canUseSearchCache ? await getCachedRcmSearch(cacheKey, 2 * 60 * 1000) : null
    if (persistentCached) {
        searchCache.set(cacheKey, { data: persistentCached, timestamp: now })
        const merged = await mergeRcmVehiclesWithCache(persistentCached?.availablecars || [])
        const refreshedVehicles = filterVehiclesForPickup(merged, pickupLocation)
        const priced = await addLocalPricing(refreshedVehicles)
        return NextResponse.json({ success: true, partnerDiscount, data: { ...persistentCached, availablecars: applyPartnerDiscount(priced.vehicles) }, pricing: { mode: priced.mode, matched: priced.matched }, source: 'local-cache' }, {
            headers: { 'Cache-Control': 'public, max-age=120' },
        })
    }

    const searchRcm = (fromDate: string, fromTime: string, toDate: string, toTime: string) => rcmSearch({
        pickupLocationId: LOCATION_IDS[pickupLocation] || 1,
        dropoffLocationId: LOCATION_IDS[dropoffLocation] || 1,
        pickupDate: toRCMDate(fromDate),
        pickupTime: fromTime,
        dropoffDate: toRCMDate(toDate),
        dropoffTime: toTime,
        campaignCode: rcmPromoCode,
    })

    try {
        let results = await searchRcm(pickupDate, pickupTime || '10:00', dropoffDate, dropoffTime || '10:00')

        // RCM will not quote a pick-up before the branch next opens. Show the
        // 09:00 inventory for the same rental length instead; RCM cannot take
        // the booking itself, so these cards are staff-confirmed requests.
        const leadHours = hoursUntilNz(pickupDate, pickupTime)
        const beforeBranchOpens = leadHours >= 0 && leadHours < 24 && isRcmQuoteRefused(results?.availablecars ?? [])
        // The times RCM was actually quoted for; step3 (insurance, extras) must use them too.
        let quoteWindow: { pickupDate: string; pickupTime: string; dropoffDate: string; dropoffTime: string } | null = null
        if (beforeBranchOpens) {
            const pickupMs = nzLocalToMs(pickupDate, pickupTime)
            const nineAmMs = nextNzNineAm()
            const from = msToNzLocal(nineAmMs)
            const to = msToNzLocal(nzLocalToMs(dropoffDate, dropoffTime) + nineAmMs - pickupMs)
            results = await searchRcm(from.date, from.time, to.date, to.time)
            quoteWindow = { pickupDate: from.date, pickupTime: from.time, dropoffDate: to.date, dropoffTime: to.time }
        }
        const manualRequest = shortNotice || beforeBranchOpens

        if (promoCode) {
            const sample = results?.availablecars?.[0]
            console.log('[RCM search] public code:', promoCode, '| campaignCode:', rcmPromoCode, '| sample vehicle discount fields:', {
                avgrate: sample?.avgrate,
                totalrateafterdiscount: sample?.totalrateafterdiscount,
                totaldiscountamount: sample?.totaldiscountamount,
            })
        }

        const liveVehicles = results?.availablecars ?? []
        const vehiclesForLocation = filterVehiclesForPickup(liveVehicles, pickupLocation)
        const hasLiveAvailability = vehiclesForLocation.some(isRcmAvailable)
        // Do not let an RCM short-notice response with zero rates erase the
        // administrator's local base prices. Only refresh the catalogue from
        // a genuinely live result, or persist rows that contain a real rate.
        if (hasLiveAvailability) await saveRcmVehicles(liveVehicles)
        // RCM also returns fully-booked categories in `availablecars`. They
        // belong to the catalogue, but are not inventory available for this
        // location/date and must not be shown as search results.
        let vehiclesForDisplay = vehiclesForLocation
        if (manualRequest && hasLiveAvailability) {
            // Only cars RCM has free can be offered as a staff-confirmed request.
            vehiclesForDisplay = vehiclesForLocation
                .filter(isRcmAvailable)
                .map((vehicle: any) => ({ ...vehicle, availablemessage: MANUAL_REQUEST_MESSAGE }))
        } else if (manualRequest) {
            const cachedVehicles = await getCachedRcmVehicles()
            // Short-notice RCM responses can contain the catalogue with zero
            // rates. Use those category ids to recover the local cached quote;
            // do not use the price-filtered list because it is empty by design.
            const liveCategoryIds = new Set(liveVehicles.map((vehicle: any) => Number(vehicle.vehiclecategoryid)).filter(Boolean))
            const fallbackVehicles = cachedVehicles.vehicles
                .filter((vehicle: any) => {
                    const matchesRcmCategory = liveCategoryIds.size === 0 || liveCategoryIds.has(Number(vehicle.vehiclecategoryid))
                    if (!matchesRcmCategory) return false
                    if (pickupLocation !== 'Queenstown') return true
                    const locations = vehicle.pickupLocations || vehicle.pickup_locations || []
                    return Array.isArray(locations) && locations.includes('Queenstown')
                })
                .map((vehicle: any) => ({
                    ...vehicle,
                    available: 0,
                    availablemessage: MANUAL_REQUEST_MESSAGE,
                    localFallback: true,
                }))
            if (fallbackVehicles.length > 0) vehiclesForDisplay = fallbackVehicles
        }
        const mergedResults = {
            ...results,
            availablecars: await mergeRcmVehiclesWithCache(vehiclesForDisplay),
            localFallback: manualRequest && vehiclesForDisplay !== vehiclesForLocation,
            quoteWindow,
        }
        const priced = await addLocalPricing(mergedResults.availablecars)
        // Apply the local base rate to fallback cards only. Live RCM cards keep
        // their live price, while manual-confirmation cards need a usable quote
        // even when RCM rejects the short-notice availability request.
        const finalVehicles = priced.vehicles
            .map((vehicle: any) => {
                if (!vehicle.localFallback || vehicle.avgrate > 0 || !vehicle.localPricingPreview?.avgrate) return vehicle
                return { ...vehicle, ...vehicle.localPricingPreview, pricingSource: 'local' }
            })
            // A request card with no local quote would show as $0.
            .filter((vehicle: any) => !vehicle.localFallback || Number(vehicle.avgrate) > 0)
        const finalResults = { ...mergedResults, availablecars: applyPartnerDiscount(finalVehicles) }
        await saveRcmSearch(cacheKey, finalResults)
        searchCache.set(cacheKey, { data: finalResults, timestamp: now })

        return NextResponse.json({ success: true, partnerDiscount, data: finalResults, pricing: { mode: priced.mode, matched: priced.matched } }, {
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
