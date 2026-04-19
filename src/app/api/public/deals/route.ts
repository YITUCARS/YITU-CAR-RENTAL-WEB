import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
        .from('deals')
        .select('id, slug, title, description, value, unit, badge, image_url, content')
        .eq('active', true)
        .order('display_order')

    if (error) {
        console.error('[public/deals]', error)
        return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json(data ?? [], { 
        headers: { 
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        } 
      })


