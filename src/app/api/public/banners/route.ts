import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Never cache — banners change in real time from admin
export const dynamic = 'force-dynamic'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

export async function GET() {
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from('banners')
        .select('id, image_url, title, label, display_order')
        .eq('active', true)
        .order('display_order')

    if (error) {
        console.error('[public/banners]', error)
        return NextResponse.json([], {
            headers: { 'Cache-Control': 'no-store' },
        })
    }

    return NextResponse.json(data ?? [], {
        headers: { 'Cache-Control': 'no-store' },
    })
}
