export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'

export async function GET(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const { data, error } = await getSupabase()
        .from('rate_export_logs').select('*')
        .order('generated_at', { ascending: false })
        .limit(100)
    if (error) return fail(error.message)
    return NextResponse.json(data ?? [])
}
