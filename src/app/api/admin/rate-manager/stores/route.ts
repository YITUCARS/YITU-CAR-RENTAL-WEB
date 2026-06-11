export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'

export async function GET(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const { data, error } = await getSupabase()
        .from('rate_stores').select('*').order('name')
    if (error) return fail(error.message)
    return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const body = await req.json()
    const { data, error } = await getSupabase()
        .from('rate_stores')
        .insert({ ota_store_id: String(body.ota_store_id).trim(), name: body.name, active: body.active !== false })
        .select().single()
    if (error) return fail(error.message)
    return NextResponse.json(data)
}
