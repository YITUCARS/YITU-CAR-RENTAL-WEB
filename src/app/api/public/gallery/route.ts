export const dynamic = 'force-dynamic'

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
  const { data, error } = await supabase.storage
    .from('vehicle-images')
    .list('gallery', {
      limit: 100,
      sortBy: { column: 'name', order: 'desc' },
    })

  if (error) {
    console.error('[public-gallery]', error)
    return NextResponse.json([])
  }

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
