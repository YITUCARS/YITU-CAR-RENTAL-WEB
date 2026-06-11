export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'

export async function GET(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const { data, error } = await getSupabase()
        .from('rate_seasons').select('*').order('date_from', { ascending: false })
    if (error) return fail(error.message)
    return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const body = await req.json()
    if (!body.date_from || !body.date_to) return fail('date_from and date_to are required', 400)
    const name = body.name?.trim() || `${body.date_from} → ${body.date_to}`
    // Upsert on the (date_from, date_to) unique constraint so a season range is reused.
    const { data, error } = await getSupabase()
        .from('rate_seasons')
        .upsert({ name, date_from: body.date_from, date_to: body.date_to }, { onConflict: 'date_from,date_to' })
        .select().single()
    if (error) return fail(error.message)
    return NextResponse.json(data)
}
