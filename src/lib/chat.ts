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

const FAQ_RESPONSES: Array<{ keywords: string[]; reply: string }> = [
    {
        keywords: ['price', 'pricing', 'cost', 'rate'],
        reply: 'Our prices start from $50/day depending on vehicle type, season, and rental duration.',
    },
    {
        keywords: ['deposit', 'bond'],
        reply: 'Our standard security deposit is $200. The final amount can vary by vehicle category.',
    },
    {
        keywords: ['location', 'address', 'where', 'branch'],
        reply: 'We currently serve Christchurch, Queenstown, and Auckland. Let us know which branch you need.',
    },
    {
        keywords: ['insurance', 'cover', 'covered'],
        reply: 'Insurance options are available during booking, including basic and premium cover packages.',
    },
    {
        keywords: ['pickup', 'pick up', 'dropoff', 'drop-off', 'drop off'],
        reply: 'You can choose your pick-up and drop-off branch, date, and time during the booking flow.',
    },
]

export function getInitialBotMessage(): ChatMessage {
    return {
        sender: 'agent',
        text: 'Hi! I can help with common questions or connect you with our support team.',
        timestamp: Date.now(),
    }
}

export function matchFaqReply(text: string) {
    const normalized = text.toLowerCase()
    return FAQ_RESPONSES.find(item => item.keywords.some(keyword => normalized.includes(keyword)))?.reply ?? null
}

export function getNoMatchReply() {
    return 'I could not find a matching FAQ for that. Would you like to contact human support?'
}

export function getSupportConfirmedReply() {
    return 'Support has been notified. Please stay on this page and our team will reply here as soon as possible.'
}

export function getAgentJoinedReply() {
    return 'A support agent has joined the conversation.'
}

export function buildTelegramMessage(sessionId: string, text: string) {
    return [
        '👤 Website User',
        `sessionId: ${sessionId}`,
        '',
        text,
    ].join('\n')
}

export function extractSessionId(text?: string | null) {
    if (!text) return null
    const match = text.match(/(?:sessionId|Session):\s*([a-zA-Z0-9-]+)/i)
    return match?.[1] ?? null
}
