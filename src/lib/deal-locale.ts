// Deals keep English in the base columns and Chinese in *_zh columns (also
// shown in the WeChat mini program). On the zh site, use whichever Chinese
// fields are filled in and fall back to English for the rest.
//   tag_zh → badge pill · badge_zh → big value · title_zh / subtitle_zh / detail_zh → title / description / content
export const DEAL_ZH_COLUMNS = 'tag_zh, badge_zh, title_zh, subtitle_zh, detail_zh'

export function localizeDeal<T extends Record<string, any>>(deal: T, locale: string): T {
    if (locale !== 'zh') return deal
    const zh = (key: string) => String(deal[key] ?? '').trim()
    return {
        ...deal,
        badge: zh('tag_zh') || deal.badge,
        value: zh('badge_zh') || deal.value,
        unit: zh('badge_zh') ? '' : deal.unit,
        title: zh('title_zh') || deal.title,
        description: zh('subtitle_zh') || deal.description,
        content: zh('detail_zh') || deal.content,
    }
}

// Admin-tunable readability of white text over the deal image.
export const DEAL_TEXT_SCALES = [
    {value: 90, label: '小'},
    {value: 100, label: '标准'},
    {value: 120, label: '大'},
    {value: 140, label: '特大'},
]

export function dealTextScale(deal: {text_scale?: number | null}): number {
    const v = Number(deal.text_scale)
    return v >= 70 && v <= 180 ? v : 100
}

// Opacity (0–80 %) of an extra dark layer over the whole image.
export function dealOverlay(deal: {overlay?: number | null}): number {
    const v = Number(deal.overlay)
    return v >= 0 && v <= 80 ? v : 0
}
