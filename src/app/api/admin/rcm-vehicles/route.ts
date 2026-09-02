export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall, toRCMDate } from '@/lib/rcm'
import { getCachedRcmVehicles, saveRcmVehicles } from '@/lib/rcm-vehicle-cache'

function toYMD(date: Date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

export async function GET(req: NextRequest) {
    if (req.headers.get('x-admin-token') !== process.env.ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const cached = await getCachedRcmVehicles()
        const forceRefresh = new URL(req.url).searchParams.get('refresh') === '1'
        if (!forceRefresh && cached.vehicles.length > 0) {
            return NextResponse.json({ success: true, vehicles: cached.vehicles, source: 'local', syncedAt: cached.syncedAt })
        }

        // Search CHC→CHC 30 days out — near-term dates return incomplete vehicle data (no imageurl/names)
        const pickup = new Date()
        pickup.setDate(pickup.getDate() + 30)
        const dropoff = new Date()
        dropoff.setDate(dropoff.getDate() + 37)

        const result = await rcmCall('step2', {
            vehiclecategorytypeid: '0',
            pickuplocationid: 1,
            pickupdate: toRCMDate(toYMD(pickup)),
            pickuptime: '10:00',
            dropofflocationid: 1,
            dropoffdate: toRCMDate(toYMD(dropoff)),
            dropofftime: '10:00',
            ageid: 9,
        })

        const vehicles: any[] = result?.availablecars ?? []
        await saveRcmVehicles(vehicles, { cacheImages: true })
        return NextResponse.json({ success: true, vehicles, source: 'rcm', syncedAt: new Date().toISOString() })
    } catch (err: any) {
        const cached = await getCachedRcmVehicles()
        if (cached.vehicles.length > 0) {
            return NextResponse.json({ success: true, vehicles: cached.vehicles, source: 'local-fallback', syncedAt: cached.syncedAt })
        }
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest) {
    if (req.headers.get('x-admin-token') !== process.env.ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const vehiclecategoryid = Number(body.vehiclecategoryid)
        const pricePerDay = Number(body.price_per_day)
        if (!vehiclecategoryid || !Number.isFinite(pricePerDay) || pricePerDay <= 0) {
            return NextResponse.json({ error: '请输入有效的每日价格' }, { status: 400 })
        }

        const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
        const supabase = getSupabaseAdmin()
        const { data: current, error: readError } = await supabase
            .from('rcm_vehicle_cache')
            .select('vehicle_json')
            .eq('vehiclecategoryid', vehiclecategoryid)
            .maybeSingle()
        if (readError) throw readError
        if (!current) return NextResponse.json({ error: '未找到该车型缓存' }, { status: 404 })

        const updatedAt = new Date().toISOString()
        const { error } = await supabase
            .from('rcm_vehicle_cache')
            .update({
                vehicle_json: {
                    ...(current.vehicle_json || {}),
                    avgrate: pricePerDay,
                    totalratebeforediscount: pricePerDay,
                    totalrateafterdiscount: pricePerDay,
                    totaldiscountamount: 0,
                    localPricePerDay: pricePerDay,
                    pricingSource: 'admin',
                },
                updated_at: updatedAt,
            })
            .eq('vehiclecategoryid', vehiclecategoryid)
        if (error) throw error
        return NextResponse.json({ success: true, vehiclecategoryid, price_per_day: pricePerDay })
    } catch (error: any) {
        console.error('[admin/rcm-vehicles] price update failed:', error.message)
        return NextResponse.json({ error: error.message || '保存失败' }, { status: 500 })
    }
}
