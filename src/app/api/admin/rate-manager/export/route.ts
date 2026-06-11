export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getSupabase, isAuthed, unauthorized, fail } from '@/lib/rate-manager/db'

// Reproduces the OTA "pricing-period" template (门店ID / 车型组ID columns + the
// Min/Max-days tier rows).
//
// MARK-UP model: the OTA grosses the uploaded price back up by its commission to
// show the customer. So we upload the NET price = master × (1 − commission); the
// OTA then displays master / (the customer sees the same price as the website).
//   master $100, 15% commission  ->  upload $85  ->  OTA shows 85/(1-.15) = $100

const INSTRUCTIONS =
    '表格填写指引：\n' +
    '1.区间价格名称是必填项，一个门店至少填写一个区间名称；当在同一个门店，填写多个不同区间价格名称时，就会生成多个区间价格\n' +
    '2.预定和提车时间格式为YYYY/MM/DD\n' +
    '3.价格的格式是数值，支持两位数小数点，不需要填入货币单位\n' +
    '4.支持只录入部分车型价格，非在售车型可以不录入价格\n' +
    '5.门店ID和车型组ID是系统检验项，请勿修改或删除'

const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ota'

const fmtDate = (iso: string) => iso.replace(/-/g, '/') // YYYY-MM-DD -> YYYY/MM/DD

export async function POST(req: NextRequest) {
    if (!isAuthed(req)) return unauthorized()
    const body = await req.json()
    const { channelId, storeId, seasonId, generatedBy } = body
    const categoryIds: string[] | undefined = Array.isArray(body.categoryIds) && body.categoryIds.length
        ? body.categoryIds : undefined
    if (!channelId || !storeId || !seasonId) return fail('channelId, storeId and seasonId are required', 400)

    const sb = getSupabase()
    const [channelR, storeR, seasonR, ratesR, linksR] = await Promise.all([
        sb.from('rate_ota_channels').select('*').eq('id', channelId).single(),
        sb.from('rate_stores').select('*').eq('id', storeId).single(),
        sb.from('rate_seasons').select('*').eq('id', seasonId).single(),
        sb.from('rate_master_rates').select('*').eq('season_id', seasonId),
        sb.from('rate_store_categories').select('category_id').eq('store_id', storeId),
    ])
    if (channelR.error || !channelR.data) return fail('Channel not found', 404)
    if (storeR.error || !storeR.data) return fail('Store not found', 404)
    if (seasonR.error || !seasonR.data) return fail('Season not found', 404)

    const channel = channelR.data, store = storeR.data, season = seasonR.data
    const rateByCat = new Map<string, any>((ratesR.data ?? []).map(r => [r.category_id, r]))
    let storeCatIds = new Set<string>((linksR.data ?? []).map(l => l.category_id))
    if (categoryIds) storeCatIds = new Set(Array.from(storeCatIds).filter(id => categoryIds.includes(id)))

    const { data: cats } = await sb.from('rate_vehicle_categories').select('*').order('name')
    // Rows: store-available categories with an OTA group id and at least one tier price for this season.
    const rows = (cats ?? []).filter(c => {
        if (!storeCatIds.has(c.id) || !c.ota_group_id) return false
        const r = rateByCat.get(c.id)
        return r && (r.price_1_3 != null || r.price_4_6 != null || r.price_7_plus != null)
    })

    if (!rows.length) {
        return fail('No priced vehicle groups for this store/season. Set master rates first.', 400)
    }

    // ---- build workbook ----
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('区间价格')
    ws.columns = [
        { width: 12 }, { width: 10 }, { width: 18 }, { width: 16 }, { width: 16 },
        { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }, { width: 48 },
        { width: 10 }, { width: 10 }, { width: 10 },
    ]

    // Row 1 — instructions (merged A1:J1)
    ws.mergeCells('A1:J1')
    const r1 = ws.getCell('A1')
    r1.value = INSTRUCTIONS
    r1.alignment = { wrapText: true, vertical: 'top' }
    r1.font = { color: { argb: 'FFCC0000' }, size: 10 }
    ws.getRow(1).height = 120

    // Row 2 — column headers
    const header = ['租期结构', '门店ID', '门店名称', '区间价格名称', '预定(开始时间)', '预定(结束时间)',
        '提车(开始时间)', '提车(结束时间)', '车型组ID', '车型组名称']
    const hr = ws.getRow(2)
    header.forEach((h, i) => { hr.getCell(i + 1).value = h })
    hr.font = { bold: true }

    // Rows 3-4 — rental-length tier definitions (K/L/M = 1-3 / 4-6 / 7+ days)
    const minRow = ws.getRow(3), maxRow = ws.getRow(4)
    minRow.getCell(1).value = 'Min Days'
    maxRow.getCell(1).value = 'Max Days'
    minRow.getCell(11).value = 1; minRow.getCell(12).value = 4; minRow.getCell(13).value = 7
    maxRow.getCell(11).value = 3; maxRow.getCell(12).value = 6 // M (7+) has no max

    // Upload price = master × (1 − commission). The OTA grosses it back up to the
    // master price the customer sees on the website.
    const comm = Number(channel.commission_rate) || 0
    const upload = (p: number | null | undefined) =>
        p == null ? null : Math.round(p * (1 - comm) * 100) / 100

    const bookFrom = fmtDate(season.date_from), bookTo = fmtDate(season.date_to)
    rows.forEach(c => {
        const r = rateByCat.get(c.id)
        ws.addRow([
            '', store.ota_store_id, store.name, season.name,
            bookFrom, bookTo, bookFrom, bookTo,
            c.ota_group_id, c.ota_group_name || c.name,
            upload(r.price_1_3), upload(r.price_4_6), upload(r.price_7_plus), // OTA upload price (net)
        ])
    })

    const buffer = await wb.xlsx.writeBuffer()

    const fileName = `${slug(channel.name)}-rates-${season.date_from}-to-${season.date_to}.xlsx`

    // ---- export history ----
    await sb.from('rate_export_logs').insert({
        channel_id: channel.id, channel_name: channel.name,
        store_id: store.id, store_name: store.name,
        season_id: season.id, date_from: season.date_from, date_to: season.date_to,
        category_ids: rows.map(c => c.id),
        row_count: rows.length,
        generated_by: generatedBy || 'admin',
        file_name: fileName,
    })

    return new NextResponse(buffer, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'x-export-rows': String(rows.length),
            'x-export-filename': fileName,
        },
    })
}
