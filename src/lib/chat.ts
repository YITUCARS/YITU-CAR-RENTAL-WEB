export type ChatSender = 'user' | 'agent'
export type ChatStatus = 'bot' | 'human'

export type ChatMessage = {
    sender: ChatSender
    text: string
    timestamp: number
}

export type ChatSession = {
    sessionId: string
    status: ChatStatus
    messages: ChatMessage[]
    unreadCount: number
    createdAt: number
    updatedAt: number
    agentJoinedAt?: number | null
    lastTelegramMessageId?: number | null
}

// ── FAQ 库 ────────────────────────────────────────────────────────────────────
// 每条 FAQ 包含触发关键词和对应的机器人回复
const FAQ_RESPONSES: Array<{ keywords: string[]; reply: string }> = [
    // 价格 / Pricing
    {
        keywords: ['price', 'pricing', 'cost', 'rate', 'how much', 'cheap', 'expensive', 'fee', 'charge', '价格', '多少钱', '费用', '收费'],
        reply: 'Our daily rates start from around $69/day for a compact sedan, up to $129+/day for premium MPVs. Final pricing depends on vehicle type, rental duration, and the season. You can get an exact quote on our booking page in seconds.',
    },

    // 押金 / Deposit
    {
        keywords: ['deposit', 'bond', 'security', '押金', '定金', '保证金'],
        reply: 'We require a security bond that is pre-authorised on your credit card at pickup. The amount varies by vehicle category (typically $500–$1,500 NZD). This is released within 5–7 business days after return, provided there is no damage.',
    },

    // 地点 / Locations
    {
        keywords: ['location', 'address', 'where', 'branch', 'office', 'pickup point', 'christchurch', 'queenstown', 'auckland', '地址', '地点', '门店', '在哪', '哪里'],
        reply: 'We have branches in:\n• Christchurch — 222 Main South Road, Hornby\n• Queenstown — 1 Gray Street, Frankton\n\nOne-way rentals between Christchurch and Queenstown are available (relocation fee applies).',
    },

    // 营业时间 / Hours
    {
        keywords: ['hours', 'open', 'opening', 'closing', 'time', 'when', '营业', '几点', '时间', '开门', '关门'],
        reply: 'Our branches are open Monday to Sunday, 8:30 AM – 5:30 PM (NZ time). Pickup and dropoff outside these hours is possible for an after-hours fee of $65 per occurrence.',
    },

    // 保险 / Insurance
    {
        keywords: ['insurance', 'cover', 'covered', 'damage', 'accident', 'excess', '保险', '理赔', '事故', '损坏'],
        reply: 'We offer multiple insurance packages during booking:\n• Basic Cover (included) — standard liability\n• Reduced Excess — lowers your damage excess\n• Premium Cover — comprehensive protection\n\nYou can select your preferred option at the extras step when booking online.',
    },

    // 驾照要求 / Driver licence
    {
        keywords: ['licence', 'license', 'driving', 'driver', 'permit', 'international', 'idp', '驾照', '驾驶证', '国际驾照'],
        reply: 'You need a valid full driver\'s licence in English, or an International Driving Permit (IDP) together with your home country licence. Drivers under 26 years old will incur a young driver surcharge of $30/day.',
    },

    // 单程还车 / One-way
    {
        keywords: ['one way', 'one-way', 'different city', 'different location', 'drop off elsewhere', '单程', '异地还车', '不同城市'],
        reply: 'One-way rentals are available between Christchurch and Queenstown. A relocation fee applies and will be shown during your booking. Auckland is currently a return-only location.',
    },

    // 取消政策 / Cancellation
    {
        keywords: ['cancel', 'cancellation', 'refund', 'change', 'modify', '取消', '退款', '修改', '更改'],
        reply: 'We offer free cancellation up to 48 hours before your pickup time. Cancellations within 48 hours may forfeit the deposit. To cancel or modify a booking, use the "Manage Booking" button on our site or contact us directly.',
    },

    // 儿童座椅 / Baby seat
    {
        keywords: ['baby', 'infant', 'child', 'booster', 'car seat', 'kids', '婴儿', '儿童', '宝宝', '座椅', '儿童座椅'],
        reply: 'Baby seats, child booster seats, and infant capsules are available as optional extras during the booking process. Please add them at the Extras step — availability is subject to stock.',
    },

    // 公里限制 / Mileage
    {
        keywords: ['km', 'kilometer', 'kilometre', 'mileage', 'unlimited', 'distance', '公里', '里程', '不限'],
        reply: 'All our rentals include unlimited kilometres — there is no distance cap or hidden per-km charge. Drive as far as you need across New Zealand.',
    },

    // 还车 / Return process
    {
        keywords: ['return', 'drop off', 'dropoff', 'bring back', '还车', '归还', '交车'],
        reply: 'Simply return the vehicle to the agreed branch at your scheduled dropoff time. Please ensure it has the same fuel level as at pickup, and is in the same condition. A staff member will check the car and process your bond release.',
    },

    // 预订方式 / How to book
    {
        keywords: ['book', 'booking', 'reserve', 'reservation', 'how to', 'wechat', 'alipay', '预订', '预约', '怎么订', '如何预订', '微信', '支付宝'],
        reply: 'You can book directly on our website — just click "Book Now" at the top. Select your dates, locations, and vehicle, then complete the payment online. If you prefer to book via WeChat, please contact us through the WeChat QR code on our Contact page.',
    },

    // GPS / 导航
    {
        keywords: ['gps', 'navigation', 'nav', 'map', '导航', '地图'],
        reply: 'Our vehicles do not include a GPS unit. We recommend using Google Maps or Apple Maps on your phone — New Zealand has excellent mobile coverage in urban areas and along major highways.',
    },

    // 燃油政策 / Fuel
    {
        keywords: ['fuel', 'petrol', 'gas', 'fill', 'full tank', '油', '加油', '汽油', '满箱'],
        reply: 'Vehicles are provided with a full tank of fuel and must be returned with a full tank. If the tank is not full on return, a refuelling fee will be charged at market rate plus a service charge.',
    },
]

// ── Bot 消息工厂 ──────────────────────────────────────────────────────────────

export function getInitialBotMessage(): ChatMessage {
    return {
        sender: 'agent',
        text: 'Hi! 👋 I\'m the YITU assistant. Ask me about pricing, locations, insurance, or anything about your rental — or request human support if you need more help.',
        timestamp: Date.now(),
    }
}

export function matchFaqReply(text: string): string | null {
    const normalized = text.toLowerCase()
    return FAQ_RESPONSES.find(item =>
        item.keywords.some(keyword => normalized.includes(keyword))
    )?.reply ?? null
}

export function getNoMatchReply(): string {
    return 'I\'m not sure about that one. To connect with our team, please tap "Contact Support" below and leave your name and number — we\'ll get back to you shortly.'
}

export function getSupportConfirmedReply(): string {
    return '✅ Your message has been sent to our team. Please stay on this page — we\'ll reply here as soon as possible (usually within a few minutes during business hours).'
}

export function getAgentJoinedReply(): string {
    return 'A support agent has joined the conversation.'
}

// ── Telegram 消息格式 ─────────────────────────────────────────────────────────

export function buildTelegramMessage(params: {
    sessionId: string
    name: string
    phone: string
    message: string
}): string {
    const lines = [
        '🔔 New Customer Support Request',
        '─────────────────────────',
        `👤 Name:    ${params.name}`,
        `📞 Phone:   ${params.phone}`,
        `💬 Message: ${params.message}`,
        '─────────────────────────',
        `🔑 Session: ${params.sessionId}`,
        '',
        'Reply to this message in Telegram to respond to the customer.',
    ]
    return lines.join('\n')
}

export function extractSessionId(text?: string | null): string | null {
    if (!text) return null
    const match = text.match(/(?:sessionId|Session):\s*([a-zA-Z0-9-]+)/i)
    return match?.[1] ?? null
}
