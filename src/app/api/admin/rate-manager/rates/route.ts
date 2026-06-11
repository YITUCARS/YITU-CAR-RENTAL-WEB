export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'

// GET — master rates, optionally filtered by ?season_id=
export async function GET(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const seasonId = req.nextUrl.searchParams.get('season_id')
    let q = getSupabase().from('rate_master_rates').select('*')
    if (seasonId) q = q.eq('season_id', seasonId)
    const { data, error } = await q
    if (error) return fail(error.message)
    return NextResponse.json(data ?? [])
}

const num = (v: any): number | null =>
    v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v)

// POST — bulk set/overwrite tier prices for many categories in one season.
// Body: { categoryIds[], seasonId? | season:{name,date_from,date_to}, price_1_3, price_4_6, price_7_plus, currency? }
// If only price_1_3 is given, it is applied to all three tiers (flat per-day case).
export async function POST(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const body = await req.json()
    const sb = getSupabase()

    const categoryIds: string[] = Array.isArray(body.categoryIds) ? body.categoryIds : []
    if (!categoryIds.length) return fail('categoryIds is required', 400)

    // Resolve / create the season.
    let seasonId: string | undefined = body.seasonId
    if (!seasonId) {
        const s = body.season
        if (!s?.date_from || !s?.date_to) return fail('seasonId or season{date_from,date_to} is required', 400)
        const name = s.name?.trim() || `${s.date_from} → ${s.date_to}`
        const { data, error } = await sb.from('rate_seasons')
            .upsert({ name, date_from: s.date_from, date_to: s.date_to }, { onConflict: 'date_from,date_to' })
            .select().single()
        if (error) return fail(error.message)
        seasonId = data.id
    }

    const p13 = num(body.price_1_3)
    const p46 = num(body.price_4_6) ?? p13
    const p7 = num(body.price_7_plus) ?? p13
    const currency = body.currency || 'NZD'
    const now = new Date().toISOString()

    const rows = categoryIds.map(cid => ({
        category_id: cid,
        season_id: seasonId,
        price_1_3: p13,
        price_4_6: p46,
        price_7_plus: p7,
        currency,
        updated_at: now,
    }))

    const { data, error } = await sb
        .from('rate_master_rates')
        .upsert(rows, { onConflict: 'category_id,season_id' })
        .select()
    if (error) return fail(error.message)
    return NextResponse.json({ seasonId, updated: data?.length ?? 0, rates: data ?? [] })
}

// DELETE — remove a master rate by ?id= (clears a category/season price)
export async function DELETE(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return fail('id is required', 400)
    const { error } = await getSupabase().from('rate_master_rates').delete().eq('id', id)
    if (error) return fail(error.message)
    return NextResponse.json({ ok: true })
}
