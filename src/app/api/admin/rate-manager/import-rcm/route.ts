export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'

// Parses an RCM "Rate Export" xlsx and updates master rates.
// Expected columns (matched by header, order-independent; the header may sit below a title):
//   Category | Location | Season | Season Start | Season End | 1-3 Days | 4-6 Days | 7+ Days
// Rows are matched by OTA group ID or RCM code when those optional columns are
// present, then by the configured RCM export name, and finally by a cautious
// model/seat signature fallback for older RCM exports.

const EPOCH = Date.UTC(1899, 11, 30) // Excel serial 0

function cellText(v: any): string {
    if (v == null) return ''
    if (typeof v === 'object' && 'result' in v) return String(v.result ?? '')
    if (typeof v === 'object' && 'text' in v) return String(v.text ?? '')
    return String(v).trim()
}

function toISO(v: any): string | null {
    if (v == null || v === '') return null
    if (v instanceof Date) return new Date(v).toISOString().slice(0, 10)
    if (typeof v === 'object' && 'result' in v) return toISO(v.result)
    if (typeof v === 'number') return new Date(EPOCH + v * 86400000).toISOString().slice(0, 10)
    const d = new Date(String(v))
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function toNum(v: any): number | null {
    if (v == null || v === '') return null
    if (typeof v === 'object' && 'result' in v) return toNum(v.result)
    const n = Number(typeof v === 'string' ? v.replace(/[^0-9.\-]/g, '') : v)
    return Number.isNaN(n) ? null : n
}

export async function POST(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()

    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!file || typeof (file as any).arrayBuffer !== 'function') return fail('No file uploaded', 400)

    const buf = Buffer.from(await (file as Blob).arrayBuffer())
    const wb = new ExcelJS.Workbook()
    try { await wb.xlsx.load(buf as any) } catch { return fail('Could not read the xlsx file', 400) }
    const ws = wb.worksheets[0]
    if (!ws) return fail('Empty workbook', 400)

    // ---- locate the header row ----
    // RCM puts a "Rate Export" title and a filter summary above the header, so
    // look for the first row that has Category, Season Start and Season End.
    let headerRowNumber = 0
    let col: Record<string, number> = {}
    for (let r = 1; r <= Math.min(ws.rowCount, 10) && !headerRowNumber; r++) {
        const found: Record<string, number> = {}
        ws.getRow(r).eachCell((cell, c) => {
            const h = cellText(cell.value).toLowerCase().replace(/\s+/g, '')
            if (h === 'category') found.name = c
            else if (['otagroupid', 'otagroup', 'otaid', 'groupid'].includes(h)) found.otaId = c
            else if (['rcmcategorycode', 'rcmcode', 'categorycode'].includes(h)) found.rcmCode = c
            else if (h === 'seasonstart' || h === 'start' || h === 'datefrom') found.start = c
            else if (h === 'seasonend' || h === 'end' || h === 'dateto') found.end = c
            else if (h.startsWith('1-3')) found.p13 = c
            else if (h.startsWith('4-6')) found.p46 = c
            else if (h.startsWith('7+') || h.startsWith('7days')) found.p7 = c
        })
        if (found.name && found.start && found.end) {
            headerRowNumber = r
            col = found
        }
    }
    if (!headerRowNumber) {
        return fail('Missing required columns (Category / Season Start / Season End). Is this an RCM Rate Export?', 400)
    }

    // ---- parse data rows ----
    type Parsed = { name: string; otaId: string; rcmCode: string; from: string; to: string; p13: number | null; p46: number | null; p7: number | null }
    const parsed: Parsed[] = []
    for (let r = headerRowNumber + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r)
        const name = cellText(row.getCell(col.name).value)
        if (!name) continue
        const from = toISO(row.getCell(col.start).value)
        const to = toISO(row.getCell(col.end).value)
        if (!from || !to) continue
        parsed.push({
            name,
            otaId: col.otaId ? cellText(row.getCell(col.otaId).value) : '',
            rcmCode: col.rcmCode ? cellText(row.getCell(col.rcmCode).value) : '',
            from, to,
            p13: col.p13 ? toNum(row.getCell(col.p13).value) : null,
            p46: col.p46 ? toNum(row.getCell(col.p46).value) : null,
            p7: col.p7 ? toNum(row.getCell(col.p7).value) : null,
        })
    }
    if (!parsed.length) return fail('No price rows found in the file', 400)

    const sb = getSupabase()

    // ---- upsert the distinct seasons ----
    const seasonKey = (p: Parsed) => `${p.from}__${p.to}`
    const seasonMap = new Map<string, { id: string; name: string; date_from: string; date_to: string }>()
    for (const p of parsed) {
        const key = seasonKey(p)
        if (seasonMap.has(key)) continue
        const name = `${p.from} → ${p.to}`
        const { data, error } = await sb.from('rate_seasons')
            .upsert({ name, date_from: p.from, date_to: p.to }, { onConflict: 'date_from,date_to' })
            .select().single()
        if (error) return fail(error.message)
        seasonMap.set(key, data)
    }

    // ---- match categories by stable IDs first, then configured names ----
    const { data: cats } = await sb.from('rate_vehicle_categories').select('id, name, rcm_export_name, rcm_category_code, ota_group_id, ota_group_name')
    const byName = new Map<string, string>()
    const byOtaId = new Map<string, string>()
    const byRcmCode = new Map<string, string[]>()
    for (const c of cats ?? []) {
        for (const value of [c.rcm_export_name, c.name, c.ota_group_name]) {
            if (value) byName.set(value.trim().toLowerCase(), c.id)
        }
        if (c.ota_group_id) byOtaId.set(String(c.ota_group_id).trim().toLowerCase(), c.id)
        if (c.rcm_category_code) byRcmCode.set(String(c.rcm_category_code).trim().toLowerCase(), [...(byRcmCode.get(String(c.rcm_category_code).trim().toLowerCase()) || []), c.id])
    }

    const ignoredWords = new Set(['toyota', 'nissan', 'honda', 'bmw', 'audi', ' seats', 'seat', 'similar', 'or', 'the'])
    function signature(value: string) {
        return value.toLowerCase().replace(/[()·,./_-]+/g, ' ').split(/\s+/).filter(Boolean)
    }
    function seatCount(value: string) {
        const match = value.match(/(?:seat|座)\s*(\d+)|(?:\d+)\s*(?:seat|座)/i)
        return match ? Number(match[1] || match[0].match(/\d+/)?.[0]) : null
    }
    function fallbackCategoryId(name: string) {
        const sourceTokens = signature(name).filter(token => token.length >= 3 && !ignoredWords.has(token))
        const sourceSeats = seatCount(name)
        const scored = (cats || []).map(category => {
            const candidateTokens = signature([category.name, category.rcm_export_name, category.ota_group_name, category.rcm_category_code].filter(Boolean).join(' '))
            const overlap = sourceTokens.filter(token => candidateTokens.includes(token)).length
            const candidateSeats = seatCount(candidateTokens.join(' '))
            const seatMatch = sourceSeats == null || candidateSeats == null || sourceSeats === candidateSeats
            return { id: category.id, score: seatMatch ? overlap : -1 }
        }).filter(item => item.score > 0).sort((a, b) => b.score - a.score)
        return scored.length && (scored.length === 1 || scored[0].score > scored[1].score) ? scored[0].id : null
    }

    const now = new Date().toISOString()
    const upserts: any[] = []
    const matchedNames = new Set<string>()
    const unmatchedMap = new Map<string, { name: string; rows: any[] }>()

    for (const p of parsed) {
        const season = seasonMap.get(seasonKey(p))!
        const codeMatches = p.rcmCode ? byRcmCode.get(p.rcmCode.trim().toLowerCase()) || [] : []
        const exactCategoryId = byName.get(p.name.trim().toLowerCase()) || fallbackCategoryId(p.name)
        const aliasCategoryIds = (() => {
            const normalized = p.name.toLowerCase().replace(/[()·,./_-]+/g, ' ')
            // RCM's older rate export calls both Alphard LVAV groups
            // "Toyota Vellfire 8 Seats". Apply the same rate to both OTA
            // groups when the export has no explicit code column.
            if (normalized.includes('vellfire') && normalized.includes('8') && normalized.includes('seat')) {
                return byRcmCode.get('lvav') || []
            }
            if (normalized.includes('vellfire') && normalized.includes('7') && normalized.includes('seat')) {
                return byRcmCode.get('uvar') || []
            }
            return []
        })()
        const matchedCategoryIds = Array.from(new Set(
            p.otaId && byOtaId.get(p.otaId.trim().toLowerCase())
                ? [byOtaId.get(p.otaId.trim().toLowerCase())!]
                : [...codeMatches, exactCategoryId, ...aliasCategoryIds].filter(Boolean) as string[],
        ))
        if (matchedCategoryIds.length) {
            matchedNames.add(p.name)
            for (const categoryId of matchedCategoryIds) {
                upserts.push({
                    category_id: categoryId, season_id: season.id,
                    price_1_3: p.p13, price_4_6: p.p46 ?? p.p13, price_7_plus: p.p7 ?? p.p13,
                    currency: 'NZD', updated_at: now,
                })
            }
        } else {
            const entry = unmatchedMap.get(p.name) ?? { name: p.name, rows: [] }
            entry.rows.push({
                seasonId: season.id, seasonName: season.name,
                price_1_3: p.p13, price_4_6: p.p46 ?? p.p13, price_7_plus: p.p7 ?? p.p13,
            })
            unmatchedMap.set(p.name, entry)
        }
    }

    let applied = 0
    if (upserts.length) {
        const { data, error } = await sb.from('rate_master_rates')
            .upsert(upserts, { onConflict: 'category_id,season_id' }).select('id')
        if (error) return fail(error.message)
        applied = data?.length ?? 0
    }

    return NextResponse.json({
        ok: true,
        parsedRows: parsed.length,
        seasons: Array.from(seasonMap.values()),
        applied,
        matchedCount: matchedNames.size,
        unmatched: Array.from(unmatchedMap.values()),
    })
}
