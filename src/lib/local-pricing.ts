import { createClient } from '@supabase/supabase-js'

type LocalPricingOptions = {
  pickupDate: string
  rentalDays: number
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function tierForDays(days: number) {
  if (days <= 3) return 'price_1_3' as const
  if (days <= 6) return 'price_4_6' as const
  return 'price_7_plus' as const
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function calculateRentalDays(pickupDate: string, pickupTime = '10:00', dropoffDate: string, dropoffTime = '10:00') {
  const pickup = new Date(`${pickupDate}T${pickupTime}:00`).getTime()
  const dropoff = new Date(`${dropoffDate}T${dropoffTime}:00`).getTime()
  if (!Number.isFinite(pickup) || !Number.isFinite(dropoff) || dropoff <= pickup) return 1
  const minutes = (dropoff - pickup) / 60000
  const wholeDays = Math.floor(minutes / (24 * 60))
  const remainder = minutes % (24 * 60)
  return Math.max(1, remainder <= 60 ? wholeDays : wholeDays + 1)
}

export function localPricingMode() {
  return String(process.env.LOCAL_PRICING_MODE || 'shadow').toLowerCase() === 'active'
    ? 'active'
    : 'shadow'
}

export async function applyLocalPrices<T extends Record<string, any>>(
  vehicles: T[],
  options: LocalPricingOptions,
) {
  const supabase = getSupabase()
  if (!supabase || !vehicles.length || !options.pickupDate || !options.rentalDays) {
    return { vehicles, matched: 0, mode: localPricingMode() }
  }

  const rcmIds = vehicles
    .map(vehicle => String(vehicle.vehiclecategoryid || ''))
    .filter(Boolean)
  if (!rcmIds.length) return { vehicles, matched: 0, mode: localPricingMode() }

  const [{ data: categories, error: categoryError }, { data: seasons, error: seasonError }] = await Promise.all([
    supabase.from('rate_vehicle_categories').select('id, ota_group_id').in('ota_group_id', rcmIds),
    supabase.from('rate_seasons').select('id, date_from, date_to').lte('date_from', options.pickupDate).gte('date_to', options.pickupDate),
  ])
  if (categoryError || seasonError || !categories?.length || !seasons?.length) {
    return { vehicles, matched: 0, mode: localPricingMode() }
  }

  const categoryIds = categories.map(category => category.id)
  const seasonIds = seasons.map(season => season.id)
  const { data: rates, error: rateError } = await supabase
    .from('rate_master_rates')
    .select('category_id, season_id, price_1_3, price_4_6, price_7_plus, currency')
    .in('category_id', categoryIds)
    .in('season_id', seasonIds)
  if (rateError || !rates?.length) return { vehicles, matched: 0, mode: localPricingMode() }

  const categoryByRcmId = new Map(categories.map(category => [String(category.ota_group_id), category]))
  const rateByKey = new Map(rates.map(rate => [`${rate.category_id}:${rate.season_id}`, rate]))
  const tier = tierForDays(options.rentalDays)
  let matched = 0

  const pricedVehicles = vehicles.map(vehicle => {
    const category = categoryByRcmId.get(String(vehicle.vehiclecategoryid))
    const season = seasons.find(item => item.date_from <= options.pickupDate && item.date_to >= options.pickupDate)
    const rate = category && season ? rateByKey.get(`${category.id}:${season.id}`) : null
    const price = Number(rate?.[tier])
    if (!Number.isFinite(price) || price <= 0) return vehicle

    matched += 1
    const total = round2(price * options.rentalDays)
    const localFields = {
      avgrate: price,
      totalratebeforediscount: total,
      totalrateafterdiscount: total,
      totaldiscountamount: 0,
      numberofdays: options.rentalDays,
      pricingSource: 'local',
      localPricePerDay: price,
    }
    return localPricingMode() === 'active' ? { ...vehicle, ...localFields } : { ...vehicle, localPricingPreview: localFields }
  })

  return { vehicles: pricedVehicles, matched, mode: localPricingMode() }
}

export async function saveRcmPriceSnapshots(input: {
  pickupLocationId: number
  dropoffLocationId: number
  pickupDate: string
  dropoffDate: string
  rentalDays: number
  vehicles: any[]
}) {
  const supabase = getSupabase()
  if (!supabase || !input.vehicles.length) return 0
  const rows = input.vehicles
    .filter(vehicle => Number(vehicle.vehiclecategoryid) && Number(vehicle.avgrate) > 0)
    .map(vehicle => ({
      vehiclecategoryid: Number(vehicle.vehiclecategoryid),
      pickup_location_id: input.pickupLocationId,
      dropoff_location_id: input.dropoffLocationId,
      pickup_date: input.pickupDate,
      dropoff_date: input.dropoffDate,
      rental_days: input.rentalDays,
      price_per_day: Number(vehicle.avgrate),
      source: 'rcm',
      vehicle_json: vehicle,
    }))
  if (!rows.length) return 0
  const { error } = await supabase.from('local_price_snapshots').insert(rows)
  if (error) {
    console.warn('[local pricing] snapshot save failed:', error.message)
    return 0
  }
  return rows.length
}
