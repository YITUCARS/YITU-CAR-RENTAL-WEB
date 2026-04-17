import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

function auth(req: NextRequest) {
    return req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from('promo_codes')
        .update(body)
        .eq('id', params.id)
        .select()
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = getSupabase()
    const { error } = await supabase.from('promo_codes').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
