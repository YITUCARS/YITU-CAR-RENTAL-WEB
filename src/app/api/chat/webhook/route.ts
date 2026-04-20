export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ChatMessage, extractSessionId, getAgentJoinedReply } from '@/lib/chat'
import { appendMessages, ensureChatSession, incrementUnread } from '@/lib/chat-store'

export async function POST(request: NextRequest) {
    try {
        const payload = await request.json()
        console.log('[webhook] received payload:', JSON.stringify(payload))

        const message = payload?.message
        if (!message?.text) {
            console.log('[webhook] no message text, skipping')
            return NextResponse.json({ ok: true })
        }

        const telegramChatId = message.chat?.id
        const text = String(message.text)
        const sessionId = extractSessionId(message.reply_to_message?.text ?? text)
        console.log('[webhook] extracted sessionId:', sessionId)

        if (!sessionId) {
            console.log('[webhook] no sessionId found, skipping')
            return NextResponse.json({ ok: true })
        }

        console.log('[webhook] ensuring chat session...')
        const chat = await ensureChatSession(sessionId)
        console.log('[webhook] chat session:', JSON.stringify(chat))

        const now = Date.now()
        const agentMessages: ChatMessage[] = []

        if (!chat.agentJoinedAt) {
            agentMessages.push({
                sender: 'agent',
                text: getAgentJoinedReply(),
                timestamp: now,
            })
        }

        agentMessages.push({
            sender: 'agent',
            text,
            timestamp: now + 1,
        })

        console.log('[webhook] appending messages...')
        await appendMessages(sessionId, agentMessages, {
            status: 'human',
            agentJoinedAt: chat.agentJoinedAt ?? now,
            lastTelegramMessageId: message.message_id ?? chat.lastTelegramMessageId ?? null,
        })
        console.log('[webhook] messages appended successfully')

        console.log('[webhook] incrementing unread count...')
        await incrementUnread(sessionId, 1)
        console.log('[webhook] unread count incremented successfully')

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('[webhook] error:', error)
        return NextResponse.json({ ok: false }, { status: 500 })
    }
}
