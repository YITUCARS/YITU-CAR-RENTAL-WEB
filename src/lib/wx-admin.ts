// Server-side check that a mini program request comes from an administrator.
// The mini program sends a fresh wx.login() code; WeChat turns it into the
// caller's openid, so the openid cannot be made up on the phone.

function wechatConfig() {
    return {
        appid: process.env.WX_APPID || process.env.WECHAT_APPID || process.env.WECHAT_MINI_APPID || process.env.NEXT_PUBLIC_WX_APPID,
        secret: process.env.WX_APP_SECRET || process.env.WECHAT_APP_SECRET || process.env.WECHAT_MINI_APP_SECRET,
    }
}

export async function openidFromLoginCode(code: string): Promise<string | null> {
    const { appid, secret } = wechatConfig()
    if (!appid || !secret || !code) return null
    const params = new URLSearchParams({ appid, secret, js_code: code, grant_type: 'authorization_code' })
    const res = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params}`)
    const data = await res.json().catch(() => ({}))
    return typeof data.openid === 'string' && !data.errcode ? data.openid : null
}

export function isWxAdminOpenid(openid: string | null): boolean {
    if (!openid) return false
    return (process.env.WX_ADMIN_OPENIDS || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .includes(openid)
}
