export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
    buildTelegramMessage,
    ChatMessage,
    getNoMatchReply,
    getSupportConfirmedReply,
    matchFaqReply,
} from '@/lib/chat'
import { appendMessages, ensureChatSession, updateChatStatus } from '@/lib/chat-store'

async function sendTelegramText(text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!token || !chatId) {
        throw new Error('Telegram environment variables are not configured.')
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
        }),
    })

    if (!response.ok) {
        throw new Error('Failed to send Telegram message.')
    }

    return response.json()
}

export async function POST(request: NextRequest) {
    try {
        const { sessionId, text, requestHuman } = await request.json()

        if (!sessionId || typeof sessionId !== 'string') {
            return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 })
        }

        const trimmedText = typeof text === 'string' ? text.trim() : ''
        const chat = await ensureChatSession(sessionId)
        const now = Date.now()

        const userMessage: ChatMessage | null = trimmedText
            ? { sender: 'user', text: trimmedText, timestamp: now }
            : null

        if (requestHuman) {
            const supportReply: ChatMessage = {
                sender: 'agent',
                text: getSupportConfirmedReply(),
                timestamp: now + 1,
            }

            const messagesToStore = [userMessage, supportReply].filter(Boolean) as ChatMessage[]
            await appendMessages(sessionId, messagesToStore, { status: 'human' })

            const telegramPayload = buildTelegramMessage({
                sessionId,
                name: 'Website User',
                phone: '—',
                message: trimmedText || 'Customer requested human support from the website chat.',
            })
            const telegramResponse = await sendTelegramText(telegramPayload)

            await updateChatStatus(sessionId, 'human', {
                lastTelegramMessageId: telegramResponse.result?.message_id ?? null,
            })

            return NextResponse.json({
                ok: true,
                messages: messagesToStore,
                status: 'human',
                supportOffered: false,
            })
        }

        if (chat.status === 'human') {
            if (!userMessage) {
                return NextResponse.json({ error: 'text is required.' }, { status: 400 })
            }

            await appendMessages(sessionId, [userMessage], { status: 'human' })
            const telegramResponse = await sendTelegramText(buildTelegramMessage({ sessionId, name: 'Website User', phone: '—', message: trimmedText }))
            await updateChatStatus(sessionId, 'human', {
                lastTelegramMessageId: telegramResponse.result?.message_id ?? chat.lastTelegramMessageId ?? null,
            })

            return NextResponse.json({
                ok: true,
                messages: [userMessage],
                status: 'human',
                supportOffered: false,
            })
        }

        if (!userMessage) {
            return NextResponse.json({ error: 'text is required.' }, { status: 400 })
        }

        const faqReply = matchFaqReply(trimmedText)
        const agentReply: ChatMessage = {
            sender: 'agent',
            text: faqReply ?? getNoMatchReply(),
            timestamp: now + 1,
        }

        await appendMessages(sessionId, [userMessage, agentReply], { status: faqReply ? 'bot' : 'bot' })

        return NextResponse.json({
            ok: true,
            messages: [userMessage, agentReply],
            status: 'bot',
            supportOffered: !faqReply,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
