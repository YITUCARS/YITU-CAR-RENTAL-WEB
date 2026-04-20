export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rcmCall, toRCMDate } from '@/lib/rcm'

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
        // Search CHC→CHC next week to get a representative fleet list
        const pickup = new Date()
        pickup.setDate(pickup.getDate() + 1)
        const dropoff = new Date()
        dropoff.setDate(dropoff.getDate() + 8)

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
        console.log('[rcm-vehicles] raw result keys:', result ? Object.keys(result) : 'null')
        console.log('[rcm-vehicles] vehicle count:', vehicles.length)
        if (vehicles.length > 0) {
            console.log('[rcm-vehicles] first vehicle sample:', JSON.stringify(vehicles[0], null, 2))
        }
        return NextResponse.json({ success: true, vehicles })
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
