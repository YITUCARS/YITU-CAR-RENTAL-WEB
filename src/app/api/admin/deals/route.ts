export const dynamic = 'force-dynamic'

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
        .from('deals')
        .select('*')
        .order('display_order')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const supabase = getSupabase()

    const { data: existing } = await supabase
        .from('deals').select('display_order').order('display_order', { ascending: false }).limit(1)
    const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0

    // Ensure slug is never empty (unique constraint on deals.slug)
    const slugBase = ((body.slug ?? '') as string).trim()
        || ((body.title ?? 'deal') as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        || 'deal'
    const slug = slugBase.length ? slugBase : `deal-${Date.now().toString(36)}`

    const { data, error } = await supabase
        .from('deals')
        .insert({
            slug,
            title: body.title ?? '',
            description: body.description ?? '',
            value: body.value ?? '',
            unit: body.unit ?? '',
            badge: body.badge ?? 'Get Offer',
            image_url: body.image_url ?? '',
            content: body.content ?? '',
            active: body.active !== false,
            display_order: body.display_order ?? nextOrder,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
