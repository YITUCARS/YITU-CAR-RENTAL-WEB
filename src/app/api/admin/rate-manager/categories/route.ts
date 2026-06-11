export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'

// GET — all vehicle categories with their store availability (store_ids)
export async function GET(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const sb = getSupabase()
    const [{ data: cats, error: e1 }, { data: links, error: e2 }] = await Promise.all([
        sb.from('rate_vehicle_categories').select('*').order('name'),
        sb.from('rate_store_categories').select('store_id, category_id'),
    ])
    if (e1) return fail(e1.message)
    if (e2) return fail(e2.message)
    const byCat = new Map<string, string[]>()
    for (const l of links ?? []) {
        const arr = byCat.get(l.category_id) ?? []
        arr.push(l.store_id)
        byCat.set(l.category_id, arr)
    }
    const out = (cats ?? []).map(c => ({ ...c, store_ids: byCat.get(c.id) ?? [] }))
    return NextResponse.json(out)
}

// POST — create a category (optionally with store_ids)
export async function POST(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const body = await req.json()
    const sb = getSupabase()
    const { store_ids, ...fields } = body
    const { data, error } = await sb
        .from('rate_vehicle_categories')
        .insert({
            name: fields.name,
            rcm_category_code: fields.rcm_category_code || null,
            rcm_export_name: fields.rcm_export_name || null,
            ota_group_id: fields.ota_group_id || null,
            ota_group_name: fields.ota_group_name || null,
            ota_codes: fields.ota_codes ?? {},
            minimum_net_revenue_per_day:
                fields.minimum_net_revenue_per_day === '' || fields.minimum_net_revenue_per_day == null
                    ? null : Number(fields.minimum_net_revenue_per_day),
            currency: fields.currency || 'NZD',
            active: fields.active !== false,
        })
        .select()
        .single()
    if (error) return fail(error.message)

    if (Array.isArray(store_ids) && store_ids.length) {
        await sb.from('rate_store_categories').insert(
            store_ids.map((sid: string) => ({ store_id: sid, category_id: data.id })),
        )
    }
    return NextResponse.json({ ...data, store_ids: store_ids ?? [] })
}
