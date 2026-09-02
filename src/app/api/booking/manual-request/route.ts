export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { escapeTelegramHtml, sendTelegramMessage } from '@/lib/telegram'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const firstName = String(body.firstName || '').trim()
        const lastName = String(body.lastName || '').trim()
        const email = String(body.email || '').trim()
        const phone = String(body.phone || '').trim()
        const wechat = String(body.wechat || '').trim()

        if (!firstName || !lastName || !phone || !EMAIL_PATTERN.test(email)) {
            return NextResponse.json({ success: false, error: 'Please provide your name, a valid email, and phone number.' }, { status: 400 })
        }

        const requestRef = `MR-${Date.now().toString(36).toUpperCase()}`
        await sendTelegramMessage({
            text: [
                '<b>Manual Booking Request</b>',
                `Request Ref: <b>${escapeTelegramHtml(requestRef)}</b>`,
                `Customer: ${escapeTelegramHtml(`${firstName} ${lastName}`)}`,
                `Email: ${escapeTelegramHtml(email)}`,
                `Phone: ${escapeTelegramHtml(phone)}`,
                wechat ? `WeChat: ${escapeTelegramHtml(wechat)}` : '',
                `Pickup: ${escapeTelegramHtml(`${body.pickupDate || '—'} ${body.pickupTime || ''}`.trim())} · ${escapeTelegramHtml(body.pickupLocation || '—')}`,
                `Dropoff: ${escapeTelegramHtml(`${body.dropoffDate || '—'} ${body.dropoffTime || ''}`.trim())} · ${escapeTelegramHtml(body.dropoffLocation || '—')}`,
                `Vehicle: ${escapeTelegramHtml(body.vehicleName || '—')}`,
                `Estimated total: NZD ${escapeTelegramHtml(Number(body.total || 0).toFixed(2))}`,
                'Status: Awaiting staff confirmation',
                'Source: Website cached vehicle request',
            ].join('\n'),
        })

        return NextResponse.json({ success: true, requestRef })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to submit booking request.'
        console.error('[manual-booking-request] error:', message)
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}
