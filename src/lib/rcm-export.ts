import crypto from 'crypto'

// RCM Export API (read-only). Docs: support.rentalcarmanager.com → "Export API Methods".
// GET https://apis.rentalcarmanager.com/export/ReservationsExport.ashx?key=…&method=…
// Signature = HMAC-SHA256(shared secret, path + query string), hex, in the `signature` header.
//
// The docs list small daily caps (repbookingexport: 6/day), but RCM doesn't enforce them for our
// key (2026-10-21: 20+ calls in a day all returned full data), so we don't limit calls. It does
// rate-limit bursts per minute (HTTP 429 "Try again in N seconds"); those calls wait and retry.
// A short in-memory cache lets all staff share one request, and if RCM errors the last good
// response is served instead.

const EXPORT_HOST = 'https://apis.rentalcarmanager.com'
const EXPORT_PATH = '/export/ReservationsExport.ashx'

type ExportParams = Record<string, string | number>

type CacheEntry = { rows: any[]; fetchedAt: number }

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<any[]>>()

function credentials() {
    const key = process.env.RCM_EXPORT_API_KEY
    const secret = process.env.RCM_EXPORT_SHARED_SECRET
    if (!key || !secret) throw new Error('RCM_EXPORT_API_KEY / RCM_EXPORT_SHARED_SECRET are not configured.')
    return { key, secret }
}

async function fetchExport(method: string, params: ExportParams): Promise<any[]> {
    const { key, secret } = credentials()
    const query = [`key=${key}`, `method=${method}`]
        .concat(Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`))
        .join('&')
    const path = `${EXPORT_PATH}?${query}`
    const signature = crypto.createHmac('sha256', secret).update(path).digest('hex').toUpperCase()

    let res: Response
    let text = ''
    for (let attempt = 0; ; attempt++) {
        res = await fetch(EXPORT_HOST + path, { headers: { signature }, cache: 'no-store' })
        text = await res.text()
        if (res.status !== 429 || attempt >= 5) break
        // "Rate limit is exceeded. Try again in 49 seconds."
        const seconds = Number(text.match(/try again in (\d+) second/i)?.[1] || 30)
        await new Promise(resolve => setTimeout(resolve, Math.min(seconds + 1, 70) * 1000))
    }
    if (!res.ok) throw new Error(`RCM export ${method} failed: ${res.status} ${text.slice(0, 200)}`)

    let data: any
    try {
        data = JSON.parse(text)
    } catch {
        throw new Error(`RCM export ${method} returned non-JSON: ${text.slice(0, 200)}`)
    }
    if (!Array.isArray(data)) throw new Error(`RCM export ${method} error: ${JSON.stringify(data).slice(0, 200)}`)
    return data
}

export type ExportResult = {
    rows: any[]
    fetchedAt: number
    /** True when RCM failed and the last good response was returned instead. */
    stale: boolean
}

/**
 * Cached export call. A fresh RCM request is made when the cached copy is older than `maxAgeMs`
 * or `force` is set; concurrent requests for the same query share one RCM call.
 */
export async function rcmExport(
    method: string,
    params: ExportParams,
    opts: { maxAgeMs: number; force?: boolean },
): Promise<ExportResult> {
    const cacheKey = `${method}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`
    const cached = cache.get(cacheKey)
    const fresh = cached && Date.now() - cached.fetchedAt < opts.maxAgeMs
    if (cached && fresh && !opts.force) return { ...cached, stale: false }

    let pending = inflight.get(cacheKey)
    if (!pending) {
        pending = fetchExport(method, params).finally(() => inflight.delete(cacheKey))
        inflight.set(cacheKey, pending)
    }

    try {
        const rows = await pending
        const entry = { rows, fetchedAt: Date.now() }
        cache.set(cacheKey, entry)
        return { ...entry, stale: false }
    } catch (err) {
        if (cached) return { ...cached, stale: true }
        throw err
    }
}

/** `2026-10-20` → `{ sd: '20261020-0000', ed: '20261020-2359' }` */
export function exportDayRange(isoDate: string) {
    const compact = isoDate.replace(/-/g, '')
    return { sd: `${compact}-0000`, ed: `${compact}-2359` }
}

/** Export datetimes look like `16/11/2026 6:00:00 PM` (pickup-location local time). */
export function parseExportDateTime(value: string | null | undefined) {
    const match = String(value ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i)
    if (!match) return { date: '', time: '' }
    const [, d, m, y, hh, mm, ampm] = match
    let hour = Number(hh)
    if (ampm) {
        if (/pm/i.test(ampm) && hour < 12) hour += 12
        if (/am/i.test(ampm) && hour === 12) hour = 0
    }
    const two = (n: number | string) => String(n).padStart(2, '0')
    return { date: `${y}-${two(m)}-${two(d)}`, time: `${two(hour)}:${mm}` }
}
