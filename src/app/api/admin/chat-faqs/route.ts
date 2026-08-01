export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_FAQS, type ChatFaq } from '@/lib/chat'
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

function normalizeFaq(id: string, data: any): ChatFaq {
  return {
    id,
    question: String(data.question || ''),
    answer: String(data.answer || ''),
    keywords: normalizeKeywords(data.keywords),
    active: data.active !== false,
    displayOrder: Number(data.displayOrder ?? data.display_order ?? 999),
  }
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const snapshot = await getAdminDb().collection('chat_faqs').get()
    const faqs = snapshot.docs
      .map(doc => normalizeFaq(doc.id, doc.data()))
      .sort((a, b) => a.displayOrder - b.displayOrder)

    return NextResponse.json({ success: true, faqs: faqs.length > 0 ? faqs : DEFAULT_FAQS })
  } catch (error) {
    console.error('[admin/chat-faqs GET] error:', error)
    return NextResponse.json({ error: 'Unable to load FAQs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
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
      createdAt: Date.now(),
    }

    if (!payload.question || !payload.answer) {
      return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 })
    }

    const ref = await getAdminDb().collection('chat_faqs').add(payload)
    return NextResponse.json({ success: true, faq: { id: ref.id, ...payload } })
  } catch (error) {
    console.error('[admin/chat-faqs POST] error:', error)
    return NextResponse.json({ error: 'Unable to save FAQ' }, { status: 500 })
  }
}
