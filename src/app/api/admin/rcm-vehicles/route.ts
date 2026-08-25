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
