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
        .from('blog_posts')
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
        .from('blog_posts')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
    const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0

    const slugBase = ((body.slug ?? '') as string).trim()
        || ((body.title ?? 'post') as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        || 'post'
    const slug = slugBase || `post-${Date.now().toString(36)}`

    // If this post is featured, unset any existing featured post
    if (body.featured) {
        await supabase.from('blog_posts').update({ featured: false }).eq('featured', true)
    }

    const { data, error } = await supabase
        .from('blog_posts')
        .insert({
            slug,
            title: body.title ?? '',
            excerpt: body.excerpt ?? '',
            category: body.category ?? 'Travel Guide',
            date: body.date ?? new Date().toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' }),
            read_time: body.read_time ?? '5 min read',
            image_url: body.image_url ?? '',
            content: body.content ?? '',
            featured: body.featured ?? false,
            active: body.active !== false,
            display_order: body.display_order ?? nextOrder,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
