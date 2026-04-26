export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    try {
        const { code } = await req.json()
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

        return NextResponse.json({ openid: wxData.openid })
    } catch (err: any) {
        console.error('[wx/login] error:', err.message)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
