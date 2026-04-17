export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key on the server side to bypass RLS.
// Falls back to anon key if service role key is not set
// (in that case, run: ALTER TABLE rcm_featured DISABLE ROW LEVEL SECURITY;)
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
        .from('rcm_featured')
        .select('slot, vehicle_json')
        .order('slot')

    if (error) {
        console.error('[featured GET]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
    if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const slots: Array<{ slot: number; vehicle_json: any }> = await req.json()
    const supabase = getSupabase()

    // Clear all existing featured slots first
    const { error: delError } = await supabase
        .from('rcm_featured')
        .delete()
        .gte('slot', 1)

    if (delError) {
        console.error('[featured DELETE]', delError)
        return NextResponse.json({ error: delError.message }, { status: 500 })
    }

    if (slots.length > 0) {
        const { error: insError } = await supabase
            .from('rcm_featured')
            .insert(
                slots.map(s => ({
                    slot: s.slot,
                    vehicle_json: s.vehicle_json,
                    updated_at: new Date().toISOString(),
                }))
            )
        if (insError) {
            console.error('[featured INSERT]', insError)
            return NextResponse.json({ error: insError.message }, { status: 500 })
        }
    }

    return NextResponse.json({ success: true })
}
