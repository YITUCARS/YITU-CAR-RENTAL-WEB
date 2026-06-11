export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'

// Parses an RCM "Rate Export" xlsx and updates master rates.
// Expected columns (matched by header, order-independent):
//   Category | Location | Season | Season Start | Season End | 1-3 Days | 4-6 Days | 7+ Days
// Rows are matched to a vehicle category by its rcm_export_name (exact, case-insensitive).

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

    // ---- locate columns from the header row ----
    const headerRow = ws.getRow(1)
    const col: Record<string, number> = {}
    headerRow.eachCell((cell, c) => {
        const h = cellText(cell.value).toLowerCase().replace(/\s+/g, '')
        if (h === 'category' || h.includes('category')) col.name = c
        else if (h.includes('start')) col.start = c
        else if (h.includes('end')) col.end = c
        else if (h.includes('1-3')) col.p13 = c
        else if (h.includes('4-6')) col.p46 = c
        else if (h.startsWith('7') || h.includes('7+')) col.p7 = c
    })
    if (!col.name || !col.start || !col.end) {
        return fail('Missing required columns (Category / Season Start / Season End). Is this an RCM Rate Export?', 400)
    }

    // ---- parse data rows ----
    type Parsed = { name: string; from: string; to: string; p13: number | null; p46: number | null; p7: number | null }
    const parsed: Parsed[] = []
    for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r)
        const name = cellText(row.getCell(col.name).value)
        if (!name) continue
        const from = toISO(row.getCell(col.start).value)
        const to = toISO(row.getCell(col.end).value)
        if (!from || !to) continue
        parsed.push({
            name, from, to,
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

    // ---- match categories by rcm_export_name ----
    const { data: cats } = await sb.from('rate_vehicle_categories').select('id, rcm_export_name')
    const byName = new Map<string, string>()
    for (const c of cats ?? []) {
        if (c.rcm_export_name) byName.set(c.rcm_export_name.trim().toLowerCase(), c.id)
    }

    const now = new Date().toISOString()
    const upserts: any[] = []
    const matchedNames = new Set<string>()
    const unmatchedMap = new Map<string, { name: string; rows: any[] }>()

    for (const p of parsed) {
        const season = seasonMap.get(seasonKey(p))!
        const catId = byName.get(p.name.trim().toLowerCase())
        if (catId) {
            matchedNames.add(p.name)
            upserts.push({
                category_id: catId, season_id: season.id,
                price_1_3: p.p13, price_4_6: p.p46 ?? p.p13, price_7_plus: p.p7 ?? p.p13,
                currency: 'NZD', updated_at: now,
            })
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
