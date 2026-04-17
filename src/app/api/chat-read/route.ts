import { NextRequest, NextResponse } from 'next/server'
import { clearUnread } from '@/lib/chat-store'

export async function POST(request: NextRequest) {
    try {
        const { sessionId } = await request.json()
        if (!sessionId || typeof sessionId !== 'string') {
            return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 })
        }

        await clearUnread(sessionId)
        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ error: 'Unable to update chat state.' }, { status: 500 })
    }
}
