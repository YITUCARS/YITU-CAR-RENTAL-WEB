export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { escapeTelegramHtml, sendTelegramMessage } from '@/lib/telegram'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clientIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    ''
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = String(body?.email || '').trim().toLowerCase()
    const pageUrl = String(body?.pageUrl || '').trim()
    const userAgent = request.headers.get('user-agent') || ''

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ success: false, error: 'Please enter a valid email address.' }, { status: 400 })
    }

    await sendTelegramMessage({
      text: [
        '<b>New Email Subscription Interest</b>',
        `Email: <b>${escapeTelegramHtml(email)}</b>`,
        pageUrl ? `Page: ${escapeTelegramHtml(pageUrl)}` : '',
        `Time: ${escapeTelegramHtml(new Date().toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' }))}`,
        clientIp(request) ? `IP: ${escapeTelegramHtml(clientIp(request))}` : '',
        userAgent ? `Browser: ${escapeTelegramHtml(userAgent.slice(0, 180))}` : '',
        'Source: Homepage subscription poster',
      ].filter(Boolean).join('\n'),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit subscription.'
    console.error('[newsletter/subscribe] error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
