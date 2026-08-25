import { rcmSearch, toRCMDate, LOCATION_IDS } from '@/lib/rcm'
import { resolveRcmPromoCode } from '@/lib/promo-code'

type Params = {
  pickupLocation: string
  dropoffLocation: string
  pickupDate: string
  pickupTime: string
  dropoffDate: string
  dropoffTime: string
  promoCode?: string
  vehicleIds: number[]
}

const cache = new Map<string, { expiresAt: number; dates: Record<string, string> }>()

function selectable(vehicle: any) {
  return String(vehicle?.availablemessage || '').trim().toLowerCase() === 'available' || vehicle?.available === 1
}

function shifted(value: string, offset: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export async function findNextAvailability(params: Params) {
  const targets = new Set(params.vehicleIds.map(String))
  if (!targets.size) return {}
  const key = JSON.stringify(params)
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.dates

  const dates: Record<string, string> = {}
  for (let start = 1; start <= 30 && targets.size; start += 5) {
    const offsets = Array.from({ length: Math.min(5, 31 - start) }, (_, index) => start + index)
    await Promise.all(offsets.map(async offset => {
      try {
        const pickupDate = shifted(params.pickupDate, offset)
        const dropoffDate = shifted(params.dropoffDate, offset)
        const result = await rcmSearch({
          pickupLocationId: LOCATION_IDS[params.pickupLocation] || 1,
          dropoffLocationId: LOCATION_IDS[params.dropoffLocation] || 1,
          pickupDate: toRCMDate(pickupDate),
          pickupTime: params.pickupTime,
          dropoffDate: toRCMDate(dropoffDate),
          dropoffTime: params.dropoffTime,
          campaignCode: resolveRcmPromoCode(params.promoCode),
        })
        for (const vehicle of result?.availablecars || []) {
          const id = String(vehicle.vehiclecategoryid)
          if (targets.has(id) && selectable(vehicle) && !dates[id]) dates[id] = pickupDate
        }
      } catch {
        // One failed future date should not prevent the remaining dates from being checked.
      }
    }))
    for (const id of Object.keys(dates)) targets.delete(id)
  }

  cache.set(key, { expiresAt: Date.now() + 10 * 60 * 1000, dates })
  return dates
}
