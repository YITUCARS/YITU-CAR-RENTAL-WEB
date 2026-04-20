export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ChatMessage, extractSessionId, getAgentJoinedReply } from '@/lib/chat'
import { appendMessages, ensureChatSession, incrementUnread } from '@/lib/chat-store'

export async function POST(request: NextRequest) {
    try {
        const payload = await request.json()
        const message = payload?.message

        if (!message?.text) {
            return NextResponse.json({ ok: true })
        }

        const telegramChatId = message.chat?.id
        const text = String(message.text)
        const sessionId = extractSessionId(message.reply_to_message?.text ?? text)

        if (!sessionId) {
            return NextResponse.json({ ok: true })
        }

        const chat = await ensureChatSession(sessionId)
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

        await appendMessages(sessionId, agentMessages, {
            status: 'human',
            agentJoinedAt: chat.agentJoinedAt ?? now,
            lastTelegramMessageId: message.message_id ?? chat.lastTelegramMessageId ?? null,
        })

        await incrementUnread(sessionId, 1)

        return NextResponse.json({ ok: true })
    } catch (error) {
        return NextResponse.json({ ok: false }, { status: 500 })
    }
}
