// Shared Supabase client + admin auth for Rate Manager API routes.
// Mirrors the auth convention used by the other /api/admin routes
// (x-admin-token header compared against ADMIN_PASSWORD).

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function getSupabase(): SupabaseClient {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}

export function isAuthed(req: NextRequest): boolean {
    return req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD
}

export function unauthorized() {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function fail(message: string, status = 500) {
    return NextResponse.json({ error: message }, { status })
}
