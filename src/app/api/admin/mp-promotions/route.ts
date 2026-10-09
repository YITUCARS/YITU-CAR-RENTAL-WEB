export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cleanPromotions, supabaseAdmin } from '@/lib/mp-promotions'
import { isWxAdminOpenid, openidFromLoginCode } from '@/lib/wx-admin'

// Saved from the mini program's admin page. The caller proves who they are with
// a fresh wx.login() code; only openids in WX_ADMIN_OPENIDS may save.
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}))
    const openid = await openidFromLoginCode(String(body.code || ''))
    if (!isWxAdminOpenid(openid)) {
        return NextResponse.json({ error: '没有权限：请确认你的微信编号已加入管理员名单', openid }, { status: 403 })
    }

    const cleaned = cleanPromotions(body.promotions)
    if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 })

    const supabase = supabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 500 })
    const updatedAt = new Date().toISOString()
    const { error } = await supabase
        .from('mp_settings')
        .upsert({ key: 'promotions', value: cleaned.promotions, updated_at: updatedAt, updated_by: openid }, { onConflict: 'key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ promotions: cleaned.promotions, updatedAt })
}
