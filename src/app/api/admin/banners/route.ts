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

export async function GET(req: NextRequest) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('display_order')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const supabase = getSupabase()

    // Find next display_order
    const { data: existing } = await supabase.from('banners').select('display_order').order('display_order', { ascending: false }).limit(1)
    const nextOrder = existing && existing.length > 0 ? (existing[0].display_order + 1) : 0

    const { data, error } = await supabase
        .from('banners')
        .insert({
            image_url: body.image_url ?? '',
            title: body.title ?? '',
            label: body.label ?? '',
            display_order: body.display_order ?? nextOrder,
            active: body.active !== false,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
