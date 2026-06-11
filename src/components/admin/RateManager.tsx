'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, Download, Upload, RefreshCw, AlertTriangle, FileSpreadsheet, DollarSign, Link2 } from 'lucide-react'
import { computeRate } from '@/lib/rate-manager/compute'
import type { RateStore, VehicleCategory, Season, MasterRate, OtaChannel, ExportLog } from '@/lib/rate-manager/types'

type SubTab = 'rates' | 'import' | 'categories' | 'channels' | 'export'
const API = '/api/admin/rate-manager'

const money = (n: number | null | undefined, ccy = 'NZD') =>
    n == null ? '—' : `${ccy === 'NZD' ? '$' : ''}${Number(n).toFixed(2)}`
const pct = (r: number) => `${(r * 100).toFixed(r * 100 % 1 === 0 ? 0 : 1)}%`

export default function RateManager({ token, showToast }: { token: string; showToast: (m: string) => void }) {
    const [sub, setSub] = useState<SubTab>('rates')
    const [loading, setLoading] = useState(false)

    const [stores, setStores] = useState<RateStore[]>([])
    const [categories, setCategories] = useState<VehicleCategory[]>([])
    const [seasons, setSeasons] = useState<Season[]>([])
    const [channels, setChannels] = useState<OtaChannel[]>([])
    const [rates, setRates] = useState<MasterRate[]>([])

    const headers = useMemo(() => ({ 'x-admin-token': token, 'Content-Type': 'application/json' }), [token])

    async function api(path: string, init?: RequestInit) {
        const res = await fetch(`${API}${path}`, { ...init, headers })
        if (!res.ok) {
            const e = await res.json().catch(() => ({}))
            throw new Error(e.error || `HTTP ${res.status}`)
        }
        return res.json()
    }

    async function loadAll() {
        setLoading(true)
        try {
            const [st, ca, se, ch] = await Promise.all([
                api('/stores'), api('/categories'), api('/seasons'), api('/channels'),
            ])
            setStores(st); setCategories(ca); setSeasons(se); setChannels(ch)
        } catch (e: any) { showToast('⚠️ ' + e.message) }
        finally { setLoading(false) }
    }
    useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // ───────────────────────── Categories ─────────────────────────
    const [editCat, setEditCat] = useState<Partial<VehicleCategory> | null>(null)
    async function saveCat() {
        if (!editCat?.name) { showToast('请填写车型组名称'); return }
        try {
            const payload = {
                name: editCat.name,
                rcm_category_code: editCat.rcm_category_code || null,
                rcm_export_name: editCat.rcm_export_name || null,
                ota_group_id: editCat.ota_group_id || null,
                ota_group_name: editCat.ota_group_name || editCat.name,
                minimum_net_revenue_per_day: editCat.minimum_net_revenue_per_day ?? null,
                store_ids: editCat.store_ids || [],
                active: editCat.active !== false,
            }
            if (editCat.id) await api(`/categories/${editCat.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
            else await api('/categories', { method: 'POST', body: JSON.stringify(payload) })
            setEditCat(null); showToast('✅ 已保存车型组')
            setCategories(await api('/categories'))
        } catch (e: any) { showToast('⚠️ ' + e.message) }
    }
    async function deleteCat(id: string) {
        if (!confirm('删除该车型组？相关价格也会被删除。')) return
        try { await api(`/categories/${id}`, { method: 'DELETE' }); setCategories(await api('/categories')); showToast('已删除') }
        catch (e: any) { showToast('⚠️ ' + e.message) }
    }

    // ───────────────────────── Seasons + rates ─────────────────────────
    const [seasonId, setSeasonId] = useState<string>('')
    useEffect(() => { if (!seasonId && seasons.length) setSeasonId(seasons[0].id) }, [seasons, seasonId])
    useEffect(() => {
        if (!seasonId) { setRates([]); return }
        api(`/rates?season_id=${seasonId}`).then(setRates).catch((e: any) => showToast('⚠️ ' + e.message))
    }, [seasonId]) // eslint-disable-line react-hooks/exhaustive-deps
    const rateByCat = useMemo(() => new Map(rates.map(r => [r.category_id, r])), [rates])

    // bulk set form
    const [newSeason, setNewSeason] = useState({ name: '', date_from: '', date_to: '' })
    const [creatingSeason, setCreatingSeason] = useState(false)
    const [bulkCats, setBulkCats] = useState<Set<string>>(new Set())
    const [bulk, setBulk] = useState({ price_1_3: '', price_4_6: '', price_7_plus: '' })

    async function applyBulk() {
        const ids = Array.from(bulkCats)
        if (!ids.length) { showToast('请选择至少一个车型组'); return }
        if (!bulk.price_1_3 && !bulk.price_4_6 && !bulk.price_7_plus) { showToast('请填写价格'); return }
        try {
            const body: any = { categoryIds: ids, ...bulk }
            if (creatingSeason) {
                if (!newSeason.date_from || !newSeason.date_to) { showToast('请填写日期范围'); return }
                body.season = newSeason
            } else {
                if (!seasonId) { showToast('请选择或新建价格区间'); return }
                body.seasonId = seasonId
            }
            const res = await api('/rates', { method: 'POST', body: JSON.stringify(body) })
            showToast(`✅ 已更新 ${res.updated} 个车型价格`)
            // refresh seasons + rates
            const se = await api('/seasons'); setSeasons(se)
            const sid = creatingSeason ? res.seasonId : seasonId
            setSeasonId(sid); setRates(await api(`/rates?season_id=${sid}`))
            setCreatingSeason(false); setBulk({ price_1_3: '', price_4_6: '', price_7_plus: '' }); setBulkCats(new Set())
        } catch (e: any) { showToast('⚠️ ' + e.message) }
    }

    // margin view channel
    const [marginChannelId, setMarginChannelId] = useState<string>('')
    useEffect(() => { if (!marginChannelId && channels.length) setMarginChannelId(channels[0].id) }, [channels, marginChannelId])
    const marginChannel = channels.find(c => c.id === marginChannelId)

    // ───────────────────────── Channels ─────────────────────────
    const [editCh, setEditCh] = useState<Partial<OtaChannel> | null>(null)
    async function saveCh() {
        if (!editCh?.name) { showToast('请填写渠道名称'); return }
        try {
            const payload = { name: editCh.name, commission_rate: editCh.commission_rate, active: editCh.active !== false }
            if (editCh.id) await api(`/channels/${editCh.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
            else await api('/channels', { method: 'POST', body: JSON.stringify(payload) })
            setEditCh(null); setChannels(await api('/channels')); showToast('✅ 已保存渠道')
        } catch (e: any) { showToast('⚠️ ' + e.message) }
    }
    async function deleteCh(id: string) {
        if (!confirm('删除该 OTA 渠道？')) return
        try { await api(`/channels/${id}`, { method: 'DELETE' }); setChannels(await api('/channels')); showToast('已删除') }
        catch (e: any) { showToast('⚠️ ' + e.message) }
    }

    // ───────────────────────── RCM import ─────────────────────────
    const rcmFileRef = useRef<HTMLInputElement>(null)
    const [importing, setImporting] = useState(false)
    const [report, setReport] = useState<any>(null)
    const [bindSel, setBindSel] = useState<Record<string, string>>({})

    async function importRcm(file: File) {
        setImporting(true)
        try {
            const fd = new FormData(); fd.append('file', file)
            const res = await fetch(`${API}/import-rcm`, { method: 'POST', headers: { 'x-admin-token': token }, body: fd })
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }
            const rep = await res.json()
            setReport(rep); setBindSel({})
            showToast(`✅ 导入完成：更新 ${rep.applied} 条，${rep.unmatched.length} 个未匹配`)
            const se = await api('/seasons'); setSeasons(se)
            const sid = seasonId || rep.seasons?.[0]?.id
            if (sid) { setSeasonId(sid); setRates(await api(`/rates?season_id=${sid}`)) }
        } catch (e: any) { showToast('⚠️ ' + e.message) }
        finally { setImporting(false); if (rcmFileRef.current) rcmFileRef.current.value = '' }
    }

    async function bindAndApply(u: { name: string; rows: any[] }) {
        const catId = bindSel[u.name]
        if (!catId) { showToast('请先选择要绑定的车型组'); return }
        try {
            await api(`/categories/${catId}`, { method: 'PATCH', body: JSON.stringify({ rcm_export_name: u.name }) })
            for (const row of u.rows) {
                await api('/rates', { method: 'POST', body: JSON.stringify({ categoryIds: [catId], seasonId: row.seasonId, price_1_3: row.price_1_3, price_4_6: row.price_4_6, price_7_plus: row.price_7_plus }) })
            }
            showToast(`✅ 已绑定并应用：${u.name}`)
            setReport((p: any) => ({ ...p, applied: p.applied + u.rows.length, unmatched: p.unmatched.filter((x: any) => x.name !== u.name) }))
            setCategories(await api('/categories'))
            if (seasonId) setRates(await api(`/rates?season_id=${seasonId}`))
        } catch (e: any) { showToast('⚠️ ' + e.message) }
    }

    // ───────────────────────── Export ─────────────────────────
    const [exp, setExp] = useState({ channelId: '', storeId: '', seasonId: '' })
    const [exporting, setExporting] = useState(false)
    const [logs, setLogs] = useState<ExportLog[]>([])
    useEffect(() => {
        setExp(e => ({
            channelId: e.channelId || channels[0]?.id || '',
            storeId: e.storeId || stores[0]?.id || '',
            seasonId: e.seasonId || seasonId || seasons[0]?.id || '',
        }))
    }, [channels, stores, seasons, seasonId])
    async function loadLogs() {
        try { setLogs(await api('/export-logs')) } catch (e: any) { showToast('⚠️ ' + e.message) }
    }
    useEffect(() => { if (sub === 'export') loadLogs() }, [sub]) // eslint-disable-line react-hooks/exhaustive-deps

    async function generateExcel() {
        if (!exp.channelId || !exp.storeId || !exp.seasonId) { showToast('请选择渠道、门店和价格区间'); return }
        setExporting(true)
        try {
            const res = await fetch(`${API}/export`, {
                method: 'POST', headers, body: JSON.stringify({ ...exp, generatedBy: 'admin' }),
            })
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }
            const fileName = res.headers.get('x-export-filename') || 'ota-rates.xlsx'
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url)
            showToast(`✅ 已生成 ${fileName}（${res.headers.get('x-export-rows')} 行）`)
            loadLogs()
        } catch (e: any) { showToast('⚠️ ' + e.message) }
        finally { setExporting(false) }
    }

    // ───────────────────────── render ─────────────────────────
    const SUBS: { key: SubTab; label: string }[] = [
        { key: 'rates', label: '价格设置 & 利润' },
        { key: 'import', label: 'RCM 导入' },
        { key: 'categories', label: '车型组' },
        { key: 'channels', label: 'OTA 渠道' },
        { key: 'export', label: '导出 & 历史' },
    ]

    return (
        <div className="px-8 py-6 space-y-5">
            {/* intro */}
            <div className="text-[12px] text-muted bg-navy/5 border border-black/10 rounded-xl px-4 py-3">
                <b className="text-navy">价格管理 (Rate Manager)</b> · Master Retail Price 是唯一主价格（官网展示价）。
                OTA 为加佣模式：<b>上传给 OTA 的价 = 主价 × (1 − 佣金)</b>，OTA 加佣后展示价 = 主价，保证各渠道客人看到的价与官网一致。
                价格按租期分档（1-3 / 4-6 / 7+ 天）。
            </div>

            {/* sub-tabs */}
            <div className="flex gap-1 border-b border-black/10">
                {SUBS.map(s => (
                    <button key={s.key} onClick={() => setSub(s.key)}
                        className={`px-4 py-2 text-[13px] font-syne font-bold border-b-2 -mb-px transition-colors ${sub === s.key ? 'border-orange text-orange' : 'border-transparent text-muted hover:text-navy'}`}>
                        {s.label}
                    </button>
                ))}
                <button onClick={loadAll} className="ml-auto flex items-center gap-1.5 text-[12px] text-muted hover:text-navy px-3">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 刷新
                </button>
            </div>

            {/* ═══ RATES ═══ */}
            {sub === 'rates' && (
                <div className="space-y-5">
                    {/* season picker */}
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="text-[13px] font-semibold text-navy">价格区间 / Season：</label>
                        <select value={creatingSeason ? '__new' : seasonId}
                            onChange={e => { if (e.target.value === '__new') setCreatingSeason(true); else { setCreatingSeason(false); setSeasonId(e.target.value) } }}
                            className="border border-black/15 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-orange">
                            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            <option value="__new">＋ 新建价格区间…</option>
                        </select>
                        {creatingSeason && (
                            <div className="flex items-center gap-2">
                                <input placeholder="区间名称" value={newSeason.name} onChange={e => setNewSeason(p => ({ ...p, name: e.target.value }))}
                                    className="border border-black/15 rounded-lg px-3 py-2 text-[13px] w-40 focus:outline-none focus:border-orange" />
                                <input type="date" value={newSeason.date_from} onChange={e => setNewSeason(p => ({ ...p, date_from: e.target.value }))}
                                    className="border border-black/15 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-orange" />
                                <span className="text-muted">→</span>
                                <input type="date" value={newSeason.date_to} onChange={e => setNewSeason(p => ({ ...p, date_to: e.target.value }))}
                                    className="border border-black/15 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-orange" />
                            </div>
                        )}
                        <div className="ml-auto flex items-center gap-2 text-[13px]">
                            <span className="text-muted">利润核算渠道：</span>
                            <select value={marginChannelId} onChange={e => setMarginChannelId(e.target.value)}
                                className="border border-black/15 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-orange">
                                {channels.map(c => <option key={c.id} value={c.id}>{c.name} ({pct(c.commission_rate)})</option>)}
                            </select>
                        </div>
                    </div>

                    {/* bulk set */}
                    <div className="bg-white border border-black/10 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <DollarSign size={15} className="text-orange" />
                            <span className="font-syne font-bold text-navy text-[14px]">批量设置价格</span>
                            <span className="text-[12px] text-muted">勾选下方车型 → 填入每日价 → 应用到所选区间</span>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                            <Field label="1-3 天 /日">
                                <input type="number" step="0.01" value={bulk.price_1_3} onChange={e => setBulk(p => ({ ...p, price_1_3: e.target.value }))}
                                    className="w-24 border border-black/15 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-orange" placeholder="100" />
                            </Field>
                            <Field label="4-6 天 /日 (留空=同1-3)">
                                <input type="number" step="0.01" value={bulk.price_4_6} onChange={e => setBulk(p => ({ ...p, price_4_6: e.target.value }))}
                                    className="w-24 border border-black/15 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-orange" placeholder="—" />
                            </Field>
                            <Field label="7+ 天 /日 (留空=同1-3)">
                                <input type="number" step="0.01" value={bulk.price_7_plus} onChange={e => setBulk(p => ({ ...p, price_7_plus: e.target.value }))}
                                    className="w-24 border border-black/15 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-orange" placeholder="—" />
                            </Field>
                            <button onClick={() => setBulkCats(new Set(categories.map(c => c.id)))}
                                className="text-[12px] text-muted hover:text-navy border border-black/10 rounded-lg px-3 py-2">全选车型</button>
                            <button onClick={() => setBulkCats(new Set())}
                                className="text-[12px] text-muted hover:text-navy border border-black/10 rounded-lg px-3 py-2">清空</button>
                            <button onClick={applyBulk}
                                className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-5 py-2 rounded-lg transition-colors">
                                <Check size={14} /> 应用 ({bulkCats.size})
                            </button>
                        </div>
                    </div>

                    {/* rate + margin table */}
                    <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="border-b border-black/10 bg-off-white text-left">
                                    <th className="px-3 py-2.5 w-8"></th>
                                    <th className="px-3 py-2.5 font-syne font-bold text-navy">车型组</th>
                                    <th className="px-3 py-2.5 font-syne font-bold text-navy text-center" colSpan={3}>主售价 / 天 (Master Retail)</th>
                                    <th className="px-3 py-2.5 font-syne font-bold text-navy text-center border-l border-black/10" colSpan={3}>
                                        OTA 应上传价 / 天 ({marginChannel ? `${marginChannel.name} ${pct(marginChannel.commission_rate)}` : 'OTA'})
                                    </th>
                                    <th className="px-3 py-2.5 font-syne font-bold text-navy text-center">状态</th>
                                </tr>
                                <tr className="border-b border-black/10 bg-off-white text-[11px] text-muted">
                                    <th></th><th></th>
                                    <th className="px-3 py-1 text-center">1-3</th><th className="px-3 py-1 text-center">4-6</th><th className="px-3 py-1 text-center">7+</th>
                                    <th className="px-3 py-1 text-center border-l border-black/10">1-3</th><th className="px-3 py-1 text-center">4-6</th><th className="px-3 py-1 text-center">7+</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map(c => {
                                    const rate = rateByCat.get(c.id) || null
                                    const checked = bulkCats.has(c.id)
                                    const comp = marginChannel ? computeRate(c, marginChannel, rate as any) : null
                                    return (
                                        <tr key={c.id} className="border-b border-black/[0.06] hover:bg-off-white">
                                            <td className="px-3 py-2 text-center">
                                                <input type="checkbox" checked={checked}
                                                    onChange={e => setBulkCats(prev => { const n = new Set(prev); e.target.checked ? n.add(c.id) : n.delete(c.id); return n })} />
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="text-navy text-[12.5px] leading-tight max-w-[360px] truncate" title={c.ota_group_name || c.name}>{c.name}</div>
                                                <div className="text-[10.5px] text-muted">ID {c.ota_group_id || '—'} · {c.rcm_category_code || '—'}
                                                    {c.minimum_net_revenue_per_day != null && <> · 最低净收 {money(c.minimum_net_revenue_per_day, c.currency)}</>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center font-medium">{money(rate?.price_1_3, c.currency)}</td>
                                            <td className="px-3 py-2 text-center font-medium">{money(rate?.price_4_6, c.currency)}</td>
                                            <td className="px-3 py-2 text-center font-medium">{money(rate?.price_7_plus, c.currency)}</td>
                                            {(['1_3', '4_6', '7_plus'] as const).map((t, i) => {
                                                const ct = comp?.tiers[t]
                                                return (
                                                    <td key={t} className={`px-3 py-2 text-center ${i === 0 ? 'border-l border-black/10' : ''} ${ct?.belowMinimum ? 'text-red-600 font-bold' : 'text-green-700'}`}>
                                                        {money(ct?.netRevenue, c.currency)}
                                                    </td>
                                                )
                                            })}
                                            <td className="px-3 py-2 text-center"><StatusBadge status={comp?.status || 'NO_PRICE'} /></td>
                                        </tr>
                                    )
                                })}
                                {!categories.length && <tr><td colSpan={9} className="py-10 text-center text-muted">暂无车型组，请先在「车型组」中添加</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ CATEGORIES ═══ */}
            {sub === 'categories' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => setEditCat({ name: '', currency: 'NZD', active: true, store_ids: [] })}
                            className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-5 py-2.5 rounded-xl transition-colors">
                            <Plus size={14} /> 新增车型组
                        </button>
                    </div>
                    <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
                        <table className="w-full text-[13px]">
                            <thead><tr className="border-b border-black/10 bg-off-white text-left">
                                <th className="px-4 py-3 font-syne font-bold text-navy">车型组名称</th>
                                <th className="px-4 py-3 font-syne font-bold text-navy">RCM Code</th>
                                <th className="px-4 py-3 font-syne font-bold text-navy">OTA 车型组ID</th>
                                <th className="px-4 py-3 font-syne font-bold text-navy">最低净收/日</th>
                                <th className="px-4 py-3 font-syne font-bold text-navy">门店</th>
                                <th className="px-4 py-3 font-syne font-bold text-navy text-right">操作</th>
                            </tr></thead>
                            <tbody>
                                {categories.map(c => (
                                    <tr key={c.id} className="border-b border-black/[0.06] hover:bg-off-white">
                                        <td className="px-4 py-2.5 text-navy max-w-[380px] truncate" title={c.name}>{c.name}</td>
                                        <td className="px-4 py-2.5 text-muted">{c.rcm_category_code || '—'}</td>
                                        <td className="px-4 py-2.5 font-mono text-[12px]">{c.ota_group_id || '—'}</td>
                                        <td className="px-4 py-2.5">{money(c.minimum_net_revenue_per_day, c.currency)}</td>
                                        <td className="px-4 py-2.5 text-[11px] text-muted">{(c.store_ids || []).map(id => stores.find(s => s.id === id)?.ota_store_id).filter(Boolean).join(', ') || '—'}</td>
                                        <td className="px-4 py-2.5 text-right">
                                            <button onClick={() => setEditCat({ ...c })} className="p-2 text-muted hover:text-navy border border-black/10 rounded-lg mr-1"><Pencil size={14} /></button>
                                            <button onClick={() => deleteCat(c.id)} className="p-2 text-red-400 hover:text-red-600 border border-red-100 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {!categories.length && <tr><td colSpan={6} className="py-10 text-center text-muted">暂无车型组</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ CHANNELS ═══ */}
            {sub === 'channels' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => setEditCh({ name: '', commission_rate: 0.15, active: true })}
                            className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-5 py-2.5 rounded-xl transition-colors">
                            <Plus size={14} /> 新增 OTA 渠道
                        </button>
                    </div>
                    <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
                        <table className="w-full text-[13px]">
                            <thead><tr className="border-b border-black/10 bg-off-white text-left">
                                <th className="px-4 py-3 font-syne font-bold text-navy">渠道</th>
                                <th className="px-4 py-3 font-syne font-bold text-navy">佣金率</th>
                                <th className="px-4 py-3 font-syne font-bold text-navy">定价策略</th>
                                <th className="px-4 py-3 font-syne font-bold text-navy text-right">操作</th>
                            </tr></thead>
                            <tbody>
                                {channels.map(c => (
                                    <tr key={c.id} className="border-b border-black/[0.06] hover:bg-off-white">
                                        <td className="px-4 py-2.5 font-medium text-navy">{c.name}</td>
                                        <td className="px-4 py-2.5">{pct(c.commission_rate)}</td>
                                        <td className="px-4 py-2.5 text-muted text-[12px]">{c.pricing_policy}</td>
                                        <td className="px-4 py-2.5 text-right">
                                            <button onClick={() => setEditCh({ ...c })} className="p-2 text-muted hover:text-navy border border-black/10 rounded-lg mr-1"><Pencil size={14} /></button>
                                            <button onClick={() => deleteCh(c.id)} className="p-2 text-red-400 hover:text-red-600 border border-red-100 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {!channels.length && <tr><td colSpan={4} className="py-10 text-center text-muted">暂无渠道</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ EXPORT ═══ */}
            {sub === 'export' && (
                <div className="space-y-5">
                    <div className="bg-white border border-black/10 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <FileSpreadsheet size={16} className="text-orange" />
                            <span className="font-syne font-bold text-navy text-[14px]">生成 OTA Excel</span>
                            <span className="text-[12px] text-muted">导出价 = OTA 应上传价 = 主价 × (1 − 佣金)；OTA 加佣后展示 = 主价</span>
                        </div>
                        <div className="flex flex-wrap items-end gap-4">
                            <Field label="OTA 渠道">
                                <select value={exp.channelId} onChange={e => setExp(p => ({ ...p, channelId: e.target.value }))}
                                    className="border border-black/15 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-orange min-w-[160px]">
                                    {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </Field>
                            <Field label="门店">
                                <select value={exp.storeId} onChange={e => setExp(p => ({ ...p, storeId: e.target.value }))}
                                    className="border border-black/15 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-orange min-w-[180px]">
                                    {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.ota_store_id})</option>)}
                                </select>
                            </Field>
                            <Field label="价格区间">
                                <select value={exp.seasonId} onChange={e => setExp(p => ({ ...p, seasonId: e.target.value }))}
                                    className="border border-black/15 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-orange min-w-[200px]">
                                    {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </Field>
                            <button onClick={generateExcel} disabled={exporting}
                                className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60">
                                <Download size={14} /> {exporting ? '生成中...' : 'Generate Excel'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="font-syne font-bold text-navy text-[14px] mb-2">导出历史</div>
                        <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
                            <table className="w-full text-[12.5px]">
                                <thead><tr className="border-b border-black/10 bg-off-white text-left">
                                    <th className="px-4 py-2.5 font-syne font-bold text-navy">时间</th>
                                    <th className="px-4 py-2.5 font-syne font-bold text-navy">渠道</th>
                                    <th className="px-4 py-2.5 font-syne font-bold text-navy">门店</th>
                                    <th className="px-4 py-2.5 font-syne font-bold text-navy">区间</th>
                                    <th className="px-4 py-2.5 font-syne font-bold text-navy">车型数</th>
                                    <th className="px-4 py-2.5 font-syne font-bold text-navy">操作员</th>
                                    <th className="px-4 py-2.5 font-syne font-bold text-navy">文件名</th>
                                </tr></thead>
                                <tbody>
                                    {logs.map(l => (
                                        <tr key={l.id} className="border-b border-black/[0.06]">
                                            <td className="px-4 py-2 text-muted whitespace-nowrap">{new Date(l.generated_at).toLocaleString('zh-CN')}</td>
                                            <td className="px-4 py-2">{l.channel_name}</td>
                                            <td className="px-4 py-2">{l.store_name}</td>
                                            <td className="px-4 py-2 whitespace-nowrap">{l.date_from} → {l.date_to}</td>
                                            <td className="px-4 py-2 text-center">{l.row_count}</td>
                                            <td className="px-4 py-2">{l.generated_by}</td>
                                            <td className="px-4 py-2 font-mono text-[11px] text-orange">{l.file_name}</td>
                                        </tr>
                                    ))}
                                    {!logs.length && <tr><td colSpan={7} className="py-10 text-center text-muted">暂无导出记录</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ RCM IMPORT ═══ */}
            {sub === 'import' && (
                <div className="space-y-5">
                    <div className="bg-white border border-black/10 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Upload size={16} className="text-orange" />
                            <span className="font-syne font-bold text-navy text-[14px]">上传 RCM 价格表</span>
                        </div>
                        <p className="text-[12px] text-muted mb-4">
                            在 RCM 调好价后导出 <code className="bg-black/5 px-1 rounded">Rate Export.xlsx</code>，在此上传即可自动更新主价格。
                            系统按车型组绑定的 <b>RCM 导出名称</b> 精确匹配；没匹配上的会列在下方，绑定一次以后永久自动匹配。
                        </p>
                        <input ref={rcmFileRef} type="file" accept=".xlsx" className="hidden"
                            onChange={e => e.target.files?.[0] && importRcm(e.target.files[0])} />
                        <button onClick={() => rcmFileRef.current?.click()} disabled={importing}
                            className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60">
                            <Upload size={14} /> {importing ? '导入中...' : '选择 RCM 导出表 (.xlsx)'}
                        </button>
                    </div>

                    {report && (
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-[13px] text-green-800">
                                解析 {report.parsedRows} 行 · <b>已更新 {report.applied} 条价格</b> · 匹配 {report.matchedCount} 个车型 ·
                                价格区间：{(report.seasons || []).map((s: any) => s.name).join('、')}
                                {report.unmatched.length > 0 && <> · <span className="text-amber-700">{report.unmatched.length} 个未匹配（见下）</span></>}
                            </div>

                            {report.unmatched.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 font-syne font-bold text-navy text-[14px] mb-2">
                                        <Link2 size={15} className="text-orange" /> 未匹配车型 — 绑定到车型组后即应用价格
                                    </div>
                                    <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
                                        <table className="w-full text-[13px]">
                                            <thead><tr className="border-b border-black/10 bg-off-white text-left">
                                                <th className="px-4 py-2.5 font-syne font-bold text-navy">RCM 车型名</th>
                                                <th className="px-4 py-2.5 font-syne font-bold text-navy">价格 (1-3/4-6/7+)</th>
                                                <th className="px-4 py-2.5 font-syne font-bold text-navy">绑定到车型组</th>
                                                <th className="px-4 py-2.5 font-syne font-bold text-navy text-right">操作</th>
                                            </tr></thead>
                                            <tbody>
                                                {report.unmatched.map((u: any) => {
                                                    const r0 = u.rows[0] || {}
                                                    return (
                                                        <tr key={u.name} className="border-b border-black/[0.06]">
                                                            <td className="px-4 py-2.5 text-navy">{u.name}</td>
                                                            <td className="px-4 py-2.5 text-muted">{money(r0.price_1_3)} / {money(r0.price_4_6)} / {money(r0.price_7_plus)}{u.rows.length > 1 && <span className="text-[11px]"> +{u.rows.length - 1} 区间</span>}</td>
                                                            <td className="px-4 py-2.5">
                                                                <select value={bindSel[u.name] || ''} onChange={e => setBindSel(p => ({ ...p, [u.name]: e.target.value }))}
                                                                    className="border border-black/15 rounded-lg px-2 py-1.5 text-[12.5px] focus:outline-none focus:border-orange max-w-[320px]">
                                                                    <option value="">— 选择车型组 —</option>
                                                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right">
                                                                <button onClick={() => bindAndApply(u)}
                                                                    className="inline-flex items-center gap-1 bg-navy hover:bg-navy/90 text-white text-[12px] font-bold px-3 py-1.5 rounded-lg">
                                                                    <Check size={12} /> 绑定并应用
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ─── Category edit modal ─── */}
            {editCat && (
                <Modal title={editCat.id ? '编辑车型组' : '新增车型组'} onClose={() => setEditCat(null)} onSave={saveCat}>
                    <LabeledInput label="车型组名称 (官网显示名)" value={editCat.name || ''} onChange={v => setEditCat(p => ({ ...p, name: v }))} />
                    <div className="grid grid-cols-2 gap-3">
                        <LabeledInput label="RCM Category Code" value={editCat.rcm_category_code || ''} onChange={v => setEditCat(p => ({ ...p, rcm_category_code: v }))} />
                        <LabeledInput label="OTA 车型组ID" value={editCat.ota_group_id || ''} onChange={v => setEditCat(p => ({ ...p, ota_group_id: v }))} />
                    </div>
                    <LabeledInput label="OTA 车型组名称 (导出用，默认同上)" value={editCat.ota_group_name || ''} onChange={v => setEditCat(p => ({ ...p, ota_group_name: v }))} />
                    <LabeledInput label="RCM 导出名称 (Rate Export 表 A 列，导入匹配用)" value={editCat.rcm_export_name || ''} onChange={v => setEditCat(p => ({ ...p, rcm_export_name: v }))} />
                    <LabeledInput label="最低净收入 / 天 (低于则标红)" type="number" value={editCat.minimum_net_revenue_per_day ?? ''} onChange={v => setEditCat(p => ({ ...p, minimum_net_revenue_per_day: v === '' ? null : Number(v) }))} />
                    <div>
                        <label className="block text-[12px] font-semibold text-navy mb-1.5">上架门店</label>
                        <div className="flex flex-wrap gap-3">
                            {stores.map(s => {
                                const on = (editCat.store_ids || []).includes(s.id)
                                return (
                                    <label key={s.id} className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                                        <input type="checkbox" checked={on} onChange={e => setEditCat(p => {
                                            const set = new Set(p?.store_ids || []); e.target.checked ? set.add(s.id) : set.delete(s.id)
                                            return { ...p, store_ids: Array.from(set) }
                                        })} />
                                        {s.name} ({s.ota_store_id})
                                    </label>
                                )
                            })}
                            {!stores.length && <span className="text-[12px] text-muted">暂无门店</span>}
                        </div>
                    </div>
                </Modal>
            )}

            {/* ─── Channel edit modal ─── */}
            {editCh && (
                <Modal title={editCh.id ? '编辑 OTA 渠道' : '新增 OTA 渠道'} onClose={() => setEditCh(null)} onSave={saveCh}>
                    <LabeledInput label="渠道名称" value={editCh.name || ''} onChange={v => setEditCh(p => ({ ...p, name: v }))} />
                    <LabeledInput label="佣金率 (15 或 0.15 均可)" type="number" value={editCh.commission_rate ?? ''} onChange={v => setEditCh(p => ({ ...p, commission_rate: v === '' ? 0 : Number(v) }))} />
                    <div className="text-[12px] text-muted">定价策略固定为 <code className="bg-black/5 px-1 rounded">same_retail_price</code>：佣金不影响导出价。</div>
                </Modal>
            )}
        </div>
    )
}

// ───────────────────────── small helpers ─────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div className="flex flex-col gap-1"><label className="text-[11px] font-semibold text-muted">{label}</label>{children}</div>
}

function LabeledInput({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
    return (
        <div>
            <label className="block text-[12px] font-semibold text-navy mb-1.5">{label}</label>
            <input type={type} step={type === 'number' ? '0.01' : undefined} value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full border border-black/15 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-orange" />
        </div>
    )
}

function StatusBadge({ status }: { status: 'OK' | 'WARNING' | 'NO_PRICE' }) {
    if (status === 'WARNING') return <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full"><AlertTriangle size={11} /> LOW</span>
    if (status === 'OK') return <span className="text-[11px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">OK</span>
    return <span className="text-[11px] text-muted">无价格</span>
}

function Modal({ title, children, onClose, onSave }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 sticky top-0 bg-white z-10">
                    <h2 className="font-syne font-bold text-navy text-lg">{title}</h2>
                    <button onClick={onClose} className="text-muted hover:text-navy"><X size={20} /></button>
                </div>
                <div className="px-6 py-5 space-y-4">{children}</div>
                <div className="px-6 py-4 border-t border-black/10 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm text-muted hover:text-navy border border-black/10 rounded-lg">取消</button>
                    <button onClick={onSave} className="flex items-center gap-1.5 px-5 py-2.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-sm rounded-lg">
                        <Check size={14} /> 保存
                    </button>
                </div>
            </div>
        </div>
    )
}
