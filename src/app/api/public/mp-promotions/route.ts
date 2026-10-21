export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { dealToPromotion, supabaseAdmin } from '@/lib/mp-promotions'

// Mini program home page: the website's active deals, in Chinese.
export async function GET() {
    const supabase = supabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 500 })
    const { data, error } = await supabase
        .from('deals')
        .select('id, slug, title, description, value, badge, image_url, content, display_order, tag_zh, badge_zh, title_zh, subtitle_zh, detail_zh, theme')
        .eq('active', true)
        .order('display_order')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(
        { promotions: data?.map(dealToPromotion) ?? [], updatedAt: new Date().toISOString() },
        { headers: { 'Cache-Control': 'no-store' } },
    )
}
