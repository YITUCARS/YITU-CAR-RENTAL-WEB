export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'

// PATCH — update a category; if store_ids is provided, the availability set is replaced.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    if (!isAuthed(req)) return unauthorized()
    const body = await req.json()
    const sb = getSupabase()
    const { store_ids, ...fields } = body

    const patch: Record<string, any> = {}
    for (const k of ['name', 'rcm_category_code', 'rcm_export_name', 'ota_group_id', 'ota_group_name', 'ota_codes', 'currency', 'active'] as const) {
        if (k in fields) patch[k] = fields[k] === '' ? null : fields[k]
    }
    if ('minimum_net_revenue_per_day' in fields) {
        patch.minimum_net_revenue_per_day =
            fields.minimum_net_revenue_per_day === '' || fields.minimum_net_revenue_per_day == null
                ? null : Number(fields.minimum_net_revenue_per_day)
    }

    let updated: any = null
    if (Object.keys(patch).length) {
        const { data, error } = await sb
            .from('rate_vehicle_categories').update(patch).eq('id', params.id).select().single()
        if (error) return fail(error.message)
        updated = data
    } else {
        const { data } = await sb.from('rate_vehicle_categories').select('*').eq('id', params.id).single()
        updated = data
    }

    if (Array.isArray(store_ids)) {
        await sb.from('rate_store_categories').delete().eq('category_id', params.id)
        if (store_ids.length) {
            await sb.from('rate_store_categories').insert(
                store_ids.map((sid: string) => ({ store_id: sid, category_id: params.id })),
            )
        }
    }
    return NextResponse.json({ ...updated, ...(Array.isArray(store_ids) ? { store_ids } : {}) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    if (!isAuthed(req)) return unauthorized()
    const { error } = await getSupabase().from('rate_vehicle_categories').delete().eq('id', params.id)
    if (error) return fail(error.message)
    return NextResponse.json({ ok: true })
}
