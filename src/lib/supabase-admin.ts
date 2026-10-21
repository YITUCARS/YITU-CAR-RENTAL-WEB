import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase admin credentials are not configured.')
  }

  return createClient(url, key, {
    // Next.js caches fetch() GETs in its data cache; supabase-js reads go through fetch, so a
    // read made while a table was empty kept being served (e.g. rcm_sync_state). Always hit the DB.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  })
}
