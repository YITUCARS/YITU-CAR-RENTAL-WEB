export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'

function normaliseRate(v: any): number {
    const n = Number(v)
    if (Number.isNaN(n)) return 0
    return n > 1 ? n / 100 : n
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    if (!isAuthed(req)) return unauthorized()
    const body = await req.json()
    const patch: Record<string, any> = {}
    if ('name' in body) patch.name = body.name?.trim()
    if ('commission_rate' in body) patch.commission_rate = normaliseRate(body.commission_rate)
    if ('excel_template_type' in body) patch.excel_template_type = body.excel_template_type
    if ('active' in body) patch.active = body.active
    const { data, error } = await getSupabase()
        .from('rate_ota_channels').update(patch).eq('id', params.id).select().single()
    if (error) return fail(error.message)
    return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    if (!isAuthed(req)) return unauthorized()
    const { error } = await getSupabase().from('rate_ota_channels').delete().eq('id', params.id)
    if (error) return fail(error.message)
    return NextResponse.json({ ok: true })
}
