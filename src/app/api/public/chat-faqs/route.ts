export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { DEFAULT_FAQS, type ChatFaq } from '@/lib/chat'
import { getAdminDb } from '@/lib/firebase-admin'

function normalizeFaq(id: string, data: any): ChatFaq {
  return {
    id,
    question: String(data.question || ''),
    answer: String(data.answer || ''),
    keywords: Array.isArray(data.keywords) ? data.keywords.map(String).filter(Boolean) : [],
    active: data.active !== false,
    displayOrder: Number(data.displayOrder ?? data.display_order ?? 999),
  }
}

export async function GET() {
  try {
    const snapshot = await getAdminDb()
      .collection('chat_faqs')
      .where('active', '==', true)
      .get()

    const faqs = snapshot.docs
      .map(doc => normalizeFaq(doc.id, doc.data()))
      .filter(faq => faq.question && faq.answer)
      .sort((a, b) => a.displayOrder - b.displayOrder)

    return NextResponse.json({ success: true, faqs: faqs.length > 0 ? faqs : DEFAULT_FAQS })
  } catch (error) {
    console.error('[public/chat-faqs] error:', error)
    return NextResponse.json({ success: true, faqs: DEFAULT_FAQS })
  }
}
