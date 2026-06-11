export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'

// commissionRate accepts either a fraction (0.15) or a percent (15) — normalise to a fraction.
function normaliseRate(v: any): number {
    const n = Number(v)
    if (Number.isNaN(n)) return 0
    return n > 1 ? n / 100 : n
}

export async function GET(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const { data, error } = await getSupabase()
        .from('rate_ota_channels').select('*').order('name')
    if (error) return fail(error.message)
    return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const body = await req.json()
    const { data, error } = await getSupabase()
        .from('rate_ota_channels')
        .insert({
            name: body.name?.trim(),
            commission_rate: normaliseRate(body.commission_rate),
            pricing_policy: 'same_retail_price',
            excel_template_type: body.excel_template_type || 'pricing_period',
            active: body.active !== false,
        })
        .select().single()
    if (error) return fail(error.message)
    return NextResponse.json(data)
}
