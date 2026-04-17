import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  const { data, error } = await supabase.storage
    .from('vehicle-images')
    .list('gallery', {
      limit: 100,
      sortBy: { column: 'name', order: 'desc' },
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const images = (data ?? [])
    .filter(file => file.name && !file.name.endsWith('/'))
    .map(file => {
      const path = `gallery/${file.name}`
      const { data: publicData } = supabase.storage.from('vehicle-images').getPublicUrl(path)
      return {
        name: file.name,
        path,
        url: publicData.publicUrl,
        created_at: file.created_at ?? null,
      }
    })

  return NextResponse.json(images)
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const path = typeof body.path === 'string' ? body.path : ''
  if (!path.startsWith('gallery/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { error } = await supabase.storage.from('vehicle-images').remove([path])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
