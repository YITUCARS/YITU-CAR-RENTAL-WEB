import { createClient } from '@supabase/supabase-js'

// Mini program home-page deals = the website's deals, Chinese fields.
// Edited only in the website admin (优惠活动); the mini program opens
// /zh/deals/[slug] for the full Chinese article.

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

export function supabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return null
    return createClient(url, key)
}

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

export function dealToPromotion(deal: any): MpPromotion {
    const image = text(deal.image_url, 500)
    return {
        id: text(deal.slug || deal.id, 80).replace(/[^\w-]/g, ''),
        tag: text(deal.tag_zh || deal.badge, 20),
        badge: text(deal.badge_zh || [deal.value, deal.unit].filter(Boolean).join(''), 20),
        title: text(deal.title_zh || deal.title, 60),
        subtitle: text(deal.subtitle_zh || deal.description, 120),
        detail: text(deal.detail_zh || deal.content, 300),
        theme: THEMES.includes(String(deal.theme)) ? String(deal.theme) : 'navy',
        // Mini program <image> loads https images directly.
        image: image.startsWith('https://') ? image : '',
    }
}
