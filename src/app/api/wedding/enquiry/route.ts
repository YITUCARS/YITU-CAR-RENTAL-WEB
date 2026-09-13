export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

type EnquiryPayload = {
    name?: string
    email?: string
    phone?: string
    weddingDate?: string
    location?: string
    message?: string
    vehicles?: string[]
    services?: string[]
    company?: string // honeypot, real people never see it
}

const MAX_LEN = 2000

function clean(value: unknown, limit = 200) {
    return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function cleanList(value: unknown) {
    return Array.isArray(value) ? value.map(item => clean(item, 120)).filter(Boolean).slice(0, 30) : []
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function buildRows(fields: Array<[string, string]>) {
    return fields
        .filter(([, value]) => value)
        .map(([label, value]) => `<tr><td style="padding:6px 14px 6px 0;color:#7a8699;font-size:13px;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;color:#0f1728;font-size:14px">${escapeHtml(value).replace(/\n/g, '<br />')}</td></tr>`)
        .join('')
}

async function sendWithResend(subject: string, html: string, text: string, replyTo: string) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return false

    const to = process.env.WEDDING_ENQUIRY_TO || 'booking@yiturentalcars.co.nz'
    const from = process.env.WEDDING_ENQUIRY_FROM || 'YITU Wedding <booking@yiturentalcars.co.nz>'

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to: to.split(',').map(address => address.trim()).filter(Boolean),
            subject,
            html,
            text,
            reply_to: replyTo || undefined,
        }),
    })

    if (!response.ok) {
        const detail = await response.text()
        throw new Error(`Resend rejected the message: ${response.status} ${detail.slice(0, 300)}`)
    }

    return true
}

async function sendWithTelegram(text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) return false

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
    })

    return response.ok
}

export async function POST(request: NextRequest) {
    let payload: EnquiryPayload

    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    // Bots fill every field they find; humans never see this one.
    if (clean(payload.company)) {
        return NextResponse.json({ ok: true })
    }

    const name = clean(payload.name, 120)
    const email = clean(payload.email, 160)
    const phone = clean(payload.phone, 60)
    const weddingDate = clean(payload.weddingDate, 40)
    const location = clean(payload.location, 160)
    const message = clean(payload.message, MAX_LEN)
    const vehicles = cleanList(payload.vehicles)
    const services = cleanList(payload.services)

    if (!name) {
        return NextResponse.json({ error: 'Please tell us your name.' }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    if (!vehicles.length && !services.length && !message) {
        return NextResponse.json({ error: 'Please select a vehicle or service, or leave us a note.' }, { status: 400 })
    }

    const subject = `Wedding enquiry — ${name}${weddingDate ? ` · ${weddingDate}` : ''}`

    const html = `
        <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f5f7fb;padding:28px">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6eaf2">
            <div style="background:#0a0f1c;padding:22px 26px">
              <div style="color:#e8431a;font-size:11px;letter-spacing:2px;font-weight:700;text-transform:uppercase">YITU Wedding Car Hire</div>
              <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:6px">New wedding enquiry</div>
            </div>
            <div style="padding:24px 26px">
              <table style="width:100%;border-collapse:collapse">
                ${buildRows([
                    ['Name', name],
                    ['Email', email],
                    ['Phone', phone],
                    ['Wedding date', weddingDate],
                    ['Pick-up / venue', location],
                    ['Vehicles', vehicles.join('\n')],
                    ['Services', services.join('\n')],
                    ['Message', message],
                ])}
              </table>
            </div>
            <div style="padding:14px 26px;border-top:1px solid #e6eaf2;color:#7a8699;font-size:12px">
              Sent from the wedding page at yiturentalcars.co.nz
            </div>
          </div>
        </div>
    `

    const text = [
        'New wedding enquiry',
        `Name: ${name}`,
        `Email: ${email}`,
        phone && `Phone: ${phone}`,
        weddingDate && `Wedding date: ${weddingDate}`,
        location && `Pick-up / venue: ${location}`,
        vehicles.length && `Vehicles: ${vehicles.join(', ')}`,
        services.length && `Services: ${services.join(', ')}`,
        message && `Message: ${message}`,
    ].filter(Boolean).join('\n')

    // Both channels always fire: the email is the record, Telegram is the instant ping.
    const [emailResult, telegramResult] = await Promise.allSettled([
        sendWithResend(subject, html, text, email),
        sendWithTelegram(text),
    ])

    if (emailResult.status === 'rejected') {
        console.error('[wedding-enquiry] Email delivery failed:', emailResult.reason)
    }

    if (telegramResult.status === 'rejected') {
        console.error('[wedding-enquiry] Telegram delivery failed:', telegramResult.reason)
    }

    const emailed = emailResult.status === 'fulfilled' && emailResult.value
    const notified = telegramResult.status === 'fulfilled' && telegramResult.value

    if (!emailed && !notified) {
        console.error('[wedding-enquiry] No delivery channel succeeded. Enquiry:', text)
        return NextResponse.json(
            { error: 'We could not send your enquiry right now. Please email booking@yiturentalcars.co.nz.' },
            { status: 502 }
        )
    }

    return NextResponse.json({ ok: true })
}
