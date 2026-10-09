import { createClient } from '@supabase/supabase-js'

// Home-page promotions of the WeChat mini program (Chinese only, separate from
// the website's English deals). Stored as one list under mp_settings 'promotions'.

export type MpPromotion = {
    id: string
    tag: string
    badge: string
    title: string
    subtitle: string
    detail: string
    theme: string
    image: string
}

const THEMES = ['navy', 'teal', 'orange', 'purple']
// Images bundled in the mini program; anything else is dropped.
const IMAGE_PATTERN = /^\/assets\/promos\/[a-z0-9-]+\.(jpg|png)$/
const MAX_PROMOTIONS = 12

export function supabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return null
    return createClient(url, key)
}

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

// Returns the cleaned list, or an error message for the administrator.
export function cleanPromotions(input: unknown): { promotions: MpPromotion[] } | { error: string } {
    if (!Array.isArray(input)) return { error: '优惠数据格式不正确' }
    if (input.length > MAX_PROMOTIONS) return { error: `最多 ${MAX_PROMOTIONS} 条优惠` }
    const promotions: MpPromotion[] = []
    for (let index = 0; index < input.length; index++) {
        const item = (input[index] ?? {}) as Record<string, unknown>
        const title = text(item.title, 60)
        if (!title) return { error: `第 ${index + 1} 条缺少标题` }
        const image = text(item.image, 120)
        promotions.push({
            id: text(item.id, 40).replace(/[^\w-]/g, '') || `p${Date.now()}${index}`,
            tag: text(item.tag, 20),
            badge: text(item.badge, 20),
            title,
            subtitle: text(item.subtitle, 120),
            detail: text(item.detail, 1000),
            theme: THEMES.includes(String(item.theme)) ? String(item.theme) : 'navy',
            image: IMAGE_PATTERN.test(image) ? image : '',
        })
    }
    return { promotions }
}
