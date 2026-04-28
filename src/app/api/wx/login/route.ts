export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return null
    return createClient(url, key)
}

export async function POST(req: NextRequest) {
    try {
        const { code, nickName, avatarUrl } = await req.json()
        if (!code) {
            return NextResponse.json({ error: 'Missing code' }, { status: 400 })
        }

        const appid  = process.env.WX_APPID
        const secret = process.env.WX_APP_SECRET
        if (!appid || !secret) {
            return NextResponse.json({ error: 'WeChat credentials not configured' }, { status: 500 })
        }

        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
        const wxRes = await fetch(url)
        const wxData = await wxRes.json()

        if (wxData.errcode) {
            console.error('[wx/login] WeChat error:', wxData)
            return NextResponse.json({ error: wxData.errmsg || 'WeChat login failed' }, { status: 400 })
        }

        const supabase = getSupabase()
        if (supabase && wxData.openid) {
            const { error } = await supabase
                .from('wx_users')
                .upsert({
                    openid: wxData.openid,
                    nick_name: nickName || '微信用户',
                    avatar_url: avatarUrl || null,
                    last_login_at: new Date().toISOString(),
                }, { onConflict: 'openid' })

            if (error) {
                console.error('[wx/login] save user error:', error.message)
            }
        }

        return NextResponse.json({ openid: wxData.openid })
    } catch (err: any) {
        console.error('[wx/login] error:', err.message)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
