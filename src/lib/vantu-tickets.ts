import crypto from 'crypto'

// Vantu attraction tickets bought inside the mini program and paid natively
// with WeChat Pay through YITU's merchant.
//
// The traveller picks the ticket on Vantu's ticket page (web-view); Vantu
// stores the order and the mini program opens pages/ticket-pay with its id.
// We read the order from Vantu, charge it, and once WeChat confirms the
// payment tell Vantu, which books it with Fitibo and emails the ticket.
// Calls to Vantu are signed with the secret both sides already share for
// the distributor link (YITU_DISTRIBUTOR_SIGNING_SECRET).

export type VantuTicketOrder = {
    id: string
    status: string
    activityName: string
    sessionDate: string
    sessionTime: string
    lines: { name: string; quantity: number; unitCents: number }[]
    amountCents: number
    currency: string
    customerName: string
    customerEmail: string
}

/// Marks our WeChat transactions for Vantu tickets (attach is ≤128 bytes).
export const TICKET_ATTACH_KIND = 'vt'

function vantuBase() {
    return (process.env.VANTU_TICKETS_API_BASE || 'https://vantugroup.com').replace(/\/$/, '')
}

function sign(parts: string[]) {
    const secret = process.env.YITU_DISTRIBUTOR_SIGNING_SECRET?.trim()
    if (!secret) throw new Error('Missing YITU_DISTRIBUTOR_SIGNING_SECRET')
    return crypto.createHmac('sha256', secret).update(parts.join('.')).digest('hex')
}

const now = () => String(Math.floor(Date.now() / 1000))

export async function fetchTicketOrder(orderId: string): Promise<VantuTicketOrder | null> {
    const ts = now()
    const url = new URL(`${vantuBase()}/api/web/tickets/wechat-order`)
    url.searchParams.set('id', orderId)
    url.searchParams.set('ts', ts)
    url.searchParams.set('sig', sign([ts, 'wechat-order', orderId]))
    const res = await fetch(url, { cache: 'no-store' })
    if (res.status === 404) return null
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.order) throw new Error(data.message || `Vantu order lookup failed (${res.status})`)
    return data.order as VantuTicketOrder
}

/// Tells Vantu the order is paid; Vantu issues it (once, however often this
/// is called). Throws when the ticket could not be issued, so WeChat's
/// notification is retried.
export async function reportTicketPaid(params: { orderId: string; transactionId: string; paidCents: number }) {
    const ts = now()
    const paidCents = String(Math.round(params.paidCents))
    const res = await fetch(`${vantuBase()}/api/web/tickets/wechat-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: params.orderId,
            ts,
            transactionId: params.transactionId,
            paidCents,
            sig: sign([ts, 'wechat-paid', params.orderId, params.transactionId, paidCents]),
        }),
        cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.message || `Vantu ticket issue failed (${res.status})`)
    return { status: String(data.status || '') }
}

/// The ticket order behind one of our WeChat transactions, or null when the
/// transaction is not a ticket payment.
export function ticketAttach(transaction: any): { orderId: string; nzdCents: number } | null {
    try {
        const attach = transaction?.attach ? JSON.parse(transaction.attach) : null
        if (attach?.k !== TICKET_ATTACH_KIND || !attach.o) return null
        return { orderId: String(attach.o), nzdCents: Number(attach.c) || 0 }
    } catch {
        return null
    }
}

/// A successful WeChat transaction for a ticket → issue it at Vantu.
export async function settleTicketTransaction(transaction: any) {
    const ticket = ticketAttach(transaction)
    if (!ticket) throw new Error('Not a ticket payment')
    if (transaction.trade_state !== 'SUCCESS') return { status: 'pending_payment' }
    return reportTicketPaid({
        orderId: ticket.orderId,
        transactionId: String(transaction.transaction_id || transaction.out_trade_no),
        paidCents: ticket.nzdCents,
    })
}

/// The caller's openid, from a fresh wx.login() code (never trusted from the client).
export async function openidFromLoginCode(code: string) {
    const appid = process.env.WX_APPID || process.env.WECHAT_APPID
    const secret = process.env.WX_APP_SECRET || process.env.WECHAT_APP_SECRET
    if (!code || !appid || !secret) return ''
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
    const data = await fetch(url, { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
    return String(data?.openid || '')
}

export async function getNzdCnyRate() {
    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=NZD&to=CNY', { cache: 'no-store' })
        const data = await res.json()
        const rate = Number(data?.rates?.CNY || 0)
        if (Number.isFinite(rate) && rate > 0) return rate
    } catch (err: any) {
        console.warn('[vantu-tickets] exchange-rate failed:', err.message)
    }
    return 4.3
}

export function maskEmail(email: string) {
    const [name, domain] = email.split('@')
    if (!domain) return email
    return `${name.slice(0, 2)}***@${domain}`
}
