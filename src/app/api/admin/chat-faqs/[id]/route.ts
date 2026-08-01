export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'

function auth(req: NextRequest) {
  return req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD
}

function normalizeKeywords(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean)
  return String(value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const payload = {
      question: String(body.question || '').trim(),
      answer: String(body.answer || '').trim(),
      keywords: normalizeKeywords(body.keywords),
      active: body.active !== false,
      displayOrder: Number(body.displayOrder ?? body.display_order ?? 0),
      updatedAt: Date.now(),
    }

    if (!payload.question || !payload.answer) {
      return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 })
    }

    await getAdminDb().collection('chat_faqs').doc(params.id).set(payload, { merge: true })
    return NextResponse.json({ success: true, faq: { id: params.id, ...payload } })
  } catch (error) {
    console.error('[admin/chat-faqs PUT] error:', error)
    return NextResponse.json({ error: 'Unable to update FAQ' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await getAdminDb().collection('chat_faqs').doc(params.id).delete()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/chat-faqs DELETE] error:', error)
    return NextResponse.json({ error: 'Unable to delete FAQ' }, { status: 500 })
  }
}
