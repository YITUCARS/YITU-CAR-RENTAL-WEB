export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ChatMessage, extractSessionId, getAgentJoinedReply } from '@/lib/chat'
import { appendMessages, ensureChatSession, incrementUnread } from '@/lib/chat-store'

export async function POST(request: NextRequest) {
    try {
        const payload = await request.json()
        const message = payload.message

        if (!message?.text) {
            return NextResponse.json({ ok: true })
        }

        const replyText = message.reply_to_message?.text as string | undefined
        const sessionId = extractSessionId(replyText) || extractSessionId(message.text)

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
            text: message.text,
            timestamp: now + 1,
        })

        await appendMessages(sessionId, agentMessages, {
            status: 'human',
            agentJoinedAt: chat.agentJoinedAt ?? now,
        })
        await incrementUnread(sessionId, 1)

        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 })
    }
}
