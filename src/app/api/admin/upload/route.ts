export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key so uploads bypass storage RLS
function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

export async function POST(req: NextRequest) {
    const token = req.headers.get('x-admin-token')
    if (token !== process.env.ADMIN_PASSWORD)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File
    const folder = String(formData.get('folder') || '').trim().replace(/^\/+|\/+$/g, '')
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const supabase = getSupabase()
    const ext = file.name.split('.').pop()
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const storagePath = folder ? `${folder}/${filename}` : filename

    const { error } = await supabase.storage
        .from('vehicle-images')
        .upload(storagePath, file)

    if (error) {
        console.error('[upload]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data } = supabase.storage
        .from('vehicle-images')
        .getPublicUrl(storagePath)

    return NextResponse.json({ url: data.publicUrl, path: storagePath })
}
