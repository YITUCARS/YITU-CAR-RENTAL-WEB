export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall, toRCMDate } from '@/lib/rcm'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'
import { saveRcmPriceSnapshots } from '@/lib/local-pricing'

function ymd(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const pickupLocationId = Number(body.pickupLocationId || 1)
  const dropoffLocationId = Number(body.dropoffLocationId || pickupLocationId)
  const start = body.pickupDate ? new Date(`${body.pickupDate}T00:00:00Z`) : addDays(new Date(), 30)
  if (Number.isNaN(start.getTime())) return fail('pickupDate must be YYYY-MM-DD', 400)

  const supabase = getSupabase()
  const { data: categories, error: categoryError } = await supabase
    .from('rate_vehicle_categories')
    .select('id, ota_group_id')
  if (categoryError) return fail(`Could not load local vehicle categories: ${categoryError.message}`)

  const categoryByRcmId = new Map(
    (categories || []).filter(category => category.ota_group_id).map(category => [String(category.ota_group_id), category]),
  )
  const durations = [2, 5, 8]
  const collected = new Map<number, any>()
  const snapshots: any[] = []

  for (const rentalDays of durations) {
    const pickupDate = ymd(start)
    const dropoffDate = ymd(addDays(start, rentalDays))
    const result = await rcmCall('step2', {
      vehiclecategorytypeid: '0',
      pickuplocationid: pickupLocationId,
      pickupdate: toRCMDate(pickupDate),
      pickuptime: '10:00',
      dropofflocationid: dropoffLocationId,
      dropoffdate: toRCMDate(dropoffDate),
      dropofftime: '10:00',
      ageid: 9,
    })
    const vehicles = Array.isArray(result?.availablecars) ? result.availablecars : []
    for (const vehicle of vehicles) {
      const id = Number(vehicle.vehiclecategoryid)
      if (!id || Number(vehicle.avgrate) <= 0) continue
      const localCategory = categoryByRcmId.get(String(id))
      if (!localCategory) continue
      const current = collected.get(id) || { category_id: localCategory.id, price_1_3: null, price_4_6: null, price_7_plus: null }
      if (rentalDays <= 3) current.price_1_3 = Number(vehicle.avgrate)
      else if (rentalDays <= 6) current.price_4_6 = Number(vehicle.avgrate)
      else current.price_7_plus = Number(vehicle.avgrate)
      collected.set(id, current)
      snapshots.push({ pickupDate, dropoffDate, rentalDays, vehicle })
    }
  }

  const seasonEnd = ymd(addDays(start, 365))
  const { data: season, error: seasonError } = await supabase
    .from('rate_seasons')
    .upsert({ name: `RCM baseline ${ymd(start)}`, date_from: ymd(start), date_to: seasonEnd }, { onConflict: 'date_from,date_to' })
    .select().single()
  if (seasonError) return fail(`Could not create local pricing season: ${seasonError.message}`)

  const rows = Array.from(collected.values()).map(rate => ({
    category_id: rate.category_id,
    season_id: season.id,
    price_1_3: rate.price_1_3,
    price_4_6: rate.price_4_6 ?? rate.price_1_3,
    price_7_plus: rate.price_7_plus ?? rate.price_4_6 ?? rate.price_1_3,
    currency: 'NZD',
    updated_at: new Date().toISOString(),
  }))
  if (rows.length) {
    const { error } = await supabase.from('rate_master_rates').upsert(rows, { onConflict: 'category_id,season_id' })
    if (error) return fail(`Could not save local master rates: ${error.message}`)
  }

  let savedSnapshots = 0
  for (const item of snapshots) {
    savedSnapshots += await saveRcmPriceSnapshots({
      pickupLocationId,
      dropoffLocationId,
      pickupDate: item.pickupDate,
      dropoffDate: item.dropoffDate,
      rentalDays: item.rentalDays,
      vehicles: [item.vehicle],
    })
  }

  return NextResponse.json({
    ok: true,
    season,
    queriedDurations: durations,
    matchedVehicles: rows.length,
    savedSnapshots,
    note: 'Imported prices are a baseline and remain in shadow mode until LOCAL_PRICING_MODE=active is configured.',
  })
}
