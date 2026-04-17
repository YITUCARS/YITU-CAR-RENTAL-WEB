import { NextRequest, NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { pickupDate, dropoffDate, pickupLocation, dropoffLocation } = body

        const results = await rcmCall('vehiclecategoryavailability', {
            pickuplocationid: pickupLocation,
            dropofflocationid: dropoffLocation,
            pickupdate: pickupDate,
            dropoffdate: dropoffDate,
        })

        return NextResponse.json({ success: true, data: results })
    } catch (err: any) {
        console.error('RCM search error:', err.message)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}