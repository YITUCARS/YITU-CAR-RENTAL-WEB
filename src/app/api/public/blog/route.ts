import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 60

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')
    const supabase = getSupabase()

    if (slug) {
        const { data, error } = await supabase
            .from('blog_posts')
            .select('*')
            .eq('slug', slug)
            .eq('active', true)
            .single()
        if (error || !data) return NextResponse.json(null)
        return NextResponse.json(data)
    }

    const { data, error } = await supabase
        .from('blog_posts')
        .select('id, slug, title, excerpt, category, date, read_time, image_url, featured')
        .eq('active', true)
        .order('display_order')

    if (error) {
        console.error('[public/blog]', error)
        return NextResponse.json([])
    }

    return NextResponse.json(data ?? [])
}
