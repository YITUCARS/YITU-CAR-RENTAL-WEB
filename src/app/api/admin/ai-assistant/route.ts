export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCachedRcmVehicles } from '@/lib/rcm-vehicle-cache'
import { vehicleRepo } from '@/lib/db'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

function isAdmin(req: NextRequest) {
  return req.headers.get('x-admin-token') === process.env.ADMIN_PASSWORD
}

function responseText(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text.trim()
  return (data?.output || [])
    .flatMap((item: any) => item?.content || [])
    .map((content: any) => content?.text || '')
    .join('')
    .trim()
}

function compactVehicle(vehicle: any) {
  return {
    id: vehicle.vehiclecategoryid,
    name: vehicle.categoryfriendlydescription || vehicle.vehiclecategory || 'Unnamed vehicle',
    dailyPrice: Number(vehicle.localPricePerDay || vehicle.avgrate || 0),
    seats: Number(vehicle.numberofadults || 0),
    largeBags: Number(vehicle.numberoflargecases || 0),
    smallBags: Number(vehicle.numberofsmallcases || 0),
    fuel: vehicle.fuel || vehicle.fueltype || '',
    source: vehicle.pricingSource || 'RCM catalogue',
    image: Boolean(vehicle.imageurl || vehicle.image_url),
  }
}

function parseJsonObject(value: string) {
  const cleaned = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return JSON.parse(cleaned) } catch { return null }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const message = String(body?.message || '').trim()
  const action = body?.action === 'confirm_price_update' ? 'confirm_price_update' : 'chat'
  const history = Array.isArray(body?.history)
    ? body.history.slice(-8).map((item: any) => `${item?.role === 'assistant' ? 'Assistant' : 'Admin'}: ${String(item?.content || '').trim()}`).filter(Boolean).join('\n')
    : ''
  if (!message && action !== 'confirm_price_update') return NextResponse.json({ success: false, error: '请输入问题' }, { status: 400 })

  const [rcmCache, localVehicles] = await Promise.all([
    getCachedRcmVehicles(),
    vehicleRepo.getAll().catch(() => []),
  ])
  const catalogue = rcmCache.vehicles.map(compactVehicle)
  const localGarage = (localVehicles || []).map((vehicle: any) => ({
    id: vehicle.id,
    name: `${vehicle.brand || ''} ${vehicle.model || ''}`.trim(),
    category: vehicle.category,
    dailyPrice: Number(vehicle.price_per_day || 0),
    seats: Number(vehicle.seats || 0),
    bags: Number(vehicle.bags || 0),
    fuel: vehicle.fuel || '',
    active: vehicle.active !== false,
  }))

  const stats = {
    rcmCatalogueVehicles: catalogue.length,
    localGarageVehicles: localGarage.length,
    pricedRcmVehicles: catalogue.filter(vehicle => vehicle.dailyPrice > 0).length,
    missingRcmPrices: catalogue.filter(vehicle => vehicle.dailyPrice <= 0).length,
    electricVehicles: catalogue.filter(vehicle => /electric|ev|tesla|model y|model 3|leaf|ioniq|byd/i.test(`${vehicle.name} ${vehicle.fuel}`)).length,
  }

  if (action === 'confirm_price_update') {
    const requestedUpdates = Array.isArray(body?.updates) ? body.updates : []
    if (!requestedUpdates.length || requestedUpdates.length > 100) return NextResponse.json({ success: false, error: '没有可执行的价格修改' }, { status: 400 })
    const garageById = new Map(localGarage.map(vehicle => [String(vehicle.id), vehicle]))
    const rcmById = new Map(catalogue.map(vehicle => [String(vehicle.id), vehicle]))
    const updates: Array<{ id: string; price: number; source: 'garage' | 'rcm' }> = requestedUpdates.map((item: any) => ({ id: String(item?.id || ''), price: Number(item?.price), source: item?.source === 'garage' ? 'garage' as const : 'rcm' as const }))
    if (updates.some(item => !Number.isFinite(item.price) || item.price <= 0 || item.price > 10000)) return NextResponse.json({ success: false, error: '价格必须在 0 到 10000 NZD/天之间' }, { status: 400 })
    const unknown = updates.find(item => !(item.source === 'garage' ? garageById.has(item.id) : rcmById.has(item.id)))
    if (unknown) return NextResponse.json({ success: false, error: '部分车型已不存在，请重新查询后再修改' }, { status: 409 })

    const supabase = (await import('@/lib/supabase-admin')).getSupabaseAdmin()
    const updated: Array<{ id: string; name: string; price: number }> = []
    for (const item of updates) {
      if (item.source === 'garage') {
        const { data, error } = await supabase.from('vehicles').update({ price_per_day: item.price }).eq('id', item.id).select('id, brand, model, price_per_day').single()
        if (error) throw error
        updated.push({ id: item.id, name: `${data.brand} ${data.model}`.trim(), price: Number(data.price_per_day) })
      } else {
        const current = rcmById.get(item.id)
        const row = (await supabase.from('rcm_vehicle_cache').select('vehicle_json').eq('vehiclecategoryid', Number(item.id)).maybeSingle()).data
        if (!row) throw new Error(`车型 ${item.id} 不存在`)
        const vehicleJson = { ...(row.vehicle_json || {}), avgrate: item.price, totalratebeforediscount: item.price, totalrateafterdiscount: item.price, totaldiscountamount: 0, localPricePerDay: item.price, pricingSource: 'admin' }
        const { error } = await supabase.from('rcm_vehicle_cache').update({ vehicle_json: vehicleJson, updated_at: new Date().toISOString() }).eq('vehiclecategoryid', Number(item.id))
        if (error) throw error
        updated.push({ id: item.id, name: current?.name || `Vehicle ${item.id}`, price: item.price })
      }
    }
    return NextResponse.json({ success: true, action: 'price_updated', answer: `已确认并修改 ${updated.length} 台车辆的每日价格。`, updated, stats })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      success: true,
      aiAvailable: false,
      answer: `AI 尚未配置 OPENAI_API_KEY。当前本地车辆库：${stats.rcmCatalogueVehicles} 个车型，${stats.pricedRcmVehicles} 个有价格，${stats.missingRcmPrices} 个缺少价格，电动车 ${stats.electricVehicles} 个。`,
      stats,
    })
  }

  const instructions = `You are YITU Car Rental's internal admin assistant. Use only the supplied vehicle data. Reply in the same language as the administrator and keep replies concise.

You can answer questions about the catalogue. You can also prepare price changes, but NEVER claim to have changed data before explicit confirmation. When the administrator asks to set, change, increase, decrease, or batch-update prices, resolve each vehicle to an exact supplied id and source, then output ONLY valid JSON with this shape:
{"type":"price_update","message":"short confirmation request","updates":[{"id":"exact supplied id","source":"rcm" or "garage","price":123.45,"name":"exact supplied name"}]}
Use source "garage" for manually managed local garage records and "rcm" for RCM-synced catalogue records. Do not invent ids or prices. If a vehicle cannot be resolved exactly, explain that in plain text instead of producing an update. A price is NZD per day. For ordinary questions, return concise plain text.\n\nCurrent catalogue stats:\n${JSON.stringify(stats)}\n\nRCM-synced local catalogue:\n${JSON.stringify(catalogue)}\n\nSeparate manually-managed garage records:\n${JSON.stringify(localGarage)}`

  try {
    const openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions,
        input: history ? `${history}\nAdmin: ${message}` : message,
        max_output_tokens: 500,
      }),
    })
    const data = await openAiResponse.json().catch(() => ({}))
    if (!openAiResponse.ok) throw new Error(data?.error?.message || `OpenAI request failed: ${openAiResponse.status}`)
    const answer = responseText(data)
    const parsed = parseJsonObject(answer)
    if (parsed?.type === 'price_update' && Array.isArray(parsed.updates)) {
      const updates = parsed.updates
        .map((item: any) => ({
          id: String(item?.id || ''),
          source: item?.source === 'garage' ? 'garage' : 'rcm',
          price: Number(item?.price),
          name: String(item?.name || ''),
        }))
        .filter((item: any) => item.id && item.name && Number.isFinite(item.price) && item.price > 0 && item.price <= 10000)
        .slice(0, 100)
      if (updates.length) return NextResponse.json({ success: true, aiAvailable: true, action: 'price_preview', answer: parsed.message || '请确认以下价格修改。', updates, stats })
    }
    return NextResponse.json({ success: true, aiAvailable: true, answer, stats })
  } catch (error: any) {
    console.error('[admin/ai-assistant]', error?.message || error)
    return NextResponse.json({ success: false, error: 'AI 暂时无法回答，请稍后再试。', stats }, { status: 502 })
  }
}
