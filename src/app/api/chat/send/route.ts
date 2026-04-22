export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { updateChatStatus } from '@/lib/chat-store'

export async function POST(request: NextRequest) {
    try {
        const { message, sessionId } = await request.json()

        if (!message) {
            return NextResponse.json({ error: 'message is required.' }, { status: 400 })
        }

        const token = process.env.TELEGRAM_BOT_TOKEN
        const chatId = process.env.TELEGRAM_CHAT_ID

        if (!token || !chatId) {
            return NextResponse.json({ error: 'Telegram environment variables are not configured.' }, { status: 500 })
        }

        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
            }),
        })

        if (!response.ok) {
            const errorData = await response.json()
            return NextResponse.json({ error: `Failed to send message: ${errorData.description}` }, { status: 500 })
        }

        const data = await response.json()

        // Escalate the session to human status in Firestore
        if (sessionId) {
            await updateChatStatus(sessionId, 'human', {
                agentJoinedAt: null,
                lastTelegramMessageId: data.result?.message_id ?? null,
            }).catch(() => {})
        }

        return NextResponse.json({ ok: true, result: data.result })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
