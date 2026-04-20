export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { appendMessages } from '@/lib/chat-store'
import { ensureChatSession } from '@/lib/chat-store'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, text } = await request.json()
    if (!sessionId || !text) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    await ensureChatSession(sessionId)
    await appendMessages(sessionId, [{
      sender: 'user',
      text,
      timestamp: Date.now(),
    }])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[user-message] error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}