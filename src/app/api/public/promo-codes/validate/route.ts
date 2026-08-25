export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isMappedPromoCode, normalizePromoCode } from '@/lib/promo-code'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  const code = normalizePromoCode(req.nextUrl.searchParams.get('code'))
  if (!code) {
    return NextResponse.json({ valid: false, error: 'Promo code is required.' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Mapped codes are validated here without exposing the private RCM code.
  if (isMappedPromoCode(code)) {
    return NextResponse.json({
      valid: true,
      promo: {
        code,
        discount_type: 'percent',
        discount_value: 0,
      },
    })
  }
  const { data, error } = await supabase
    .from('promo_codes')
    .select('id, code, discount_type, discount_value, active, expires_at')
    .eq('code', code)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ valid: false, error: error.message }, { status: 500 })
  }

  if (!data || !data.active) {
    return NextResponse.json({ valid: false, error: 'Promo code not found or inactive.' })
  }

  if (data.expires_at) {
    const expiresAt = new Date(data.expires_at)
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ valid: false, error: 'Promo code has expired.' })
    }
  }

  return NextResponse.json({
    valid: true,
    promo: {
      code: data.code,
      discount_type: data.discount_type,
      discount_value: Number(data.discount_value || 0),
    },
  })
}
