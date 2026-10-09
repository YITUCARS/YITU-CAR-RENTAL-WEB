export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/mp-promotions'

// Mini program home page. `promotions: null` means nothing has been saved yet,
// so the mini program keeps showing its built-in defaults.
export async function GET() {
    const supabase = supabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 500 })
    const { data, error } = await supabase
        .from('mp_settings')
        .select('value, updated_at')
        .eq('key', 'promotions')
        .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(
        { promotions: data?.value ?? null, updatedAt: data?.updated_at ?? null },
        { headers: { 'Cache-Control': 'no-store' } },
    )
}
