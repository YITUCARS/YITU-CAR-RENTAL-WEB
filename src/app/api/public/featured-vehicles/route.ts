import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

export async function GET() {
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from('rcm_featured')
        .select('slot, vehicle_json')
        .order('slot')

    if (error) {
        console.error('[featured-vehicles]', error)
        return NextResponse.json([])
    }

    const vehicles = (data ?? []).map(r => ({ slot: r.slot, ...r.vehicle_json }))
    return NextResponse.json(vehicles)
}
