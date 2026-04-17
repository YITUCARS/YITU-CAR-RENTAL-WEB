export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { rcmCall } from '@/lib/rcm'

export async function GET() {
    try {
        const results = await rcmCall('locationlist')
        return NextResponse.json({ success: true, data: results })
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}