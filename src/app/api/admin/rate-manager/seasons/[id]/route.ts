export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    if (!isAuthed(req)) return unauthorized()
    const body = await req.json()
    const patch: Record<string, any> = {}
    for (const k of ['name', 'date_from', 'date_to'] as const) if (k in body) patch[k] = body[k]
    const { data, error } = await getSupabase()
        .from('rate_seasons').update(patch).eq('id', params.id).select().single()
    if (error) return fail(error.message)
    return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    if (!isAuthed(req)) return unauthorized()
    const { error } = await getSupabase().from('rate_seasons').delete().eq('id', params.id)
    if (error) return fail(error.message)
    return NextResponse.json({ ok: true })
}
