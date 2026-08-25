import { NextRequest, NextResponse } from 'next/server'
import { LOCATION_IDS, rcmSearch, toRCMDate } from '@/lib/rcm'
import { resolveRcmPromoCode } from '@/lib/promo-code'
import { applyLocalPrices, calculateRentalDays } from '@/lib/local-pricing'
import { mergeRcmVehiclesWithCache, saveRcmSearch, saveRcmVehicles } from '@/lib/rcm-vehicle-cache'
import { partnerAuth, partnerError } from '@/lib/partner-api'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const denied = partnerAuth(req)
  if (denied) return denied
  try {
    const body = await req.json()
    const required = ['pickupLocation', 'dropoffLocation', 'pickupDate', 'dropoffDate']
    const missing = required.filter(field => !body[field])
    if (missing.length) return NextResponse.json({ success: false, error: `Missing fields: ${missing.join(', ')}` }, { status: 400 })

    const pickupTime = body.pickupTime || '10:00'
    const dropoffTime = body.dropoffTime || '10:00'
    const rcmResult = await rcmSearch({
      pickupLocationId: LOCATION_IDS[body.pickupLocation] || Number(body.pickupLocationId) || 1,
      dropoffLocationId: LOCATION_IDS[body.dropoffLocation] || Number(body.dropoffLocationId) || 1,
      pickupDate: toRCMDate(body.pickupDate),
      pickupTime,
      dropoffDate: toRCMDate(body.dropoffDate),
      dropoffTime,
      campaignCode: resolveRcmPromoCode(body.promoCode),
    })
    const merged = await mergeRcmVehiclesWithCache(rcmResult?.availablecars || [])
    await saveRcmVehicles(merged)
    const priced = await applyLocalPrices(merged, {
      pickupDate: body.pickupDate,
      rentalDays: calculateRentalDays(body.pickupDate, pickupTime, body.dropoffDate, dropoffTime),
    })
    const data = { ...rcmResult, availablecars: priced.vehicles }
    await saveRcmSearch(JSON.stringify({ partner: true, ...body }), data)
    return NextResponse.json({ success: true, data, pricing: { mode: priced.mode, matched: priced.matched } })
  } catch (error) {
    return partnerError(error)
  }
}
