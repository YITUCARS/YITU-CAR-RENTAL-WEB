export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getChatSession } from '@/lib/chat-store'

export async function GET(request: NextRequest) {
    console.log('[chat-session] route handler started')
    const sessionId = request.nextUrl.searchParams.get('sessionId')

    if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 })
    }

    try {
        console.log('[chat-session] about to call getAdminDb')
        const chat = await getChatSession(sessionId)
        return NextResponse.json({ ok: true, chat })
    } catch (error) {
        console.error('[chat-session] error:', error)
        return NextResponse.json({ error: 'Unable to load chat session.' }, { status: 500 })
    }
}
