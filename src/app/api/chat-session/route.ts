export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getChatSession } from '@/lib/chat-store'

export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get('sessionId')

    if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 })
    }

    try {
        const chat = await getChatSession(sessionId)
        return NextResponse.json({ ok: true, chat })
    } catch {
        return NextResponse.json({ error: 'Unable to load chat session.' }, { status: 500 })
    }
}
