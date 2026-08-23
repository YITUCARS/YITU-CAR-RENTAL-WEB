'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, AlertTriangle, TrendingUp, Database, CircleCheck, CircleX, Clock, ChevronRight, ChevronDown } from 'lucide-react'

/**
 * 竞品价格监控 — read-only dashboard over the market-intel dataset.
 *
 * Collection itself runs from the market-intel CLI, not from here; this page
 * only reads. The chart is the point of the whole project: how a competitor
 * reprices one pickup date as that date approaches.
 */

const API = '/api/admin/market-intel'

const FUEL_LABELS: Record<string, string> = {
    petrol: '汽油', diesel: '柴油', hybrid: '混动', plugin_hybrid: '插电混动',
    electric: '纯电', unknown: '未知',
}

const CLASS_LABELS: Record<string, string> = {
    ECONOMY: '经济型', COMPACT: '紧凑型', MIDSIZE: '中型', FULLSIZE: '大型',
    COMPACT_SUV: '小型SUV', MIDSIZE_SUV: '中型SUV', LARGE_SUV: '大型SUV',
    PREMIUM: '豪华型', EV: '电动车', VAN_8_SEAT: '8座商务', VAN_12_SEAT: '12座中巴',
}

interface Summary {
    observations: number; observations_24h: number
    first_observed_at: string | null; last_observed_at: string | null
    active_sources: number; disabled_sources: number
    pending_jobs: number; failed_jobs_24h: number
    unresolved_vehicles: number; pickup_dates_tracked: number
}
interface SourceHealth {
    source_code: string; name: string; source_type: string
    enabled: boolean; auto_disabled: boolean; auto_disabled_reason: string | null
    consecutive_failures: number; last_success_at: string | null
    pending_jobs: number; failed_jobs_24h: number; offers_24h: number
    errors_24h: number; unclassified_7d: number
}
interface MarketRow {
    vehicle_class: string; offer_count: number; supplier_count: number; source_count: number
    min_daily_price: number; median_daily_price: number; max_daily_price: number
    lead_time_days: number; currency: string
}
interface PickupDate {
    pickup_date: string; observations: number; observation_days: number
    min_lead_time_days: number; max_lead_time_days: number
}
interface CurvePoint {
    observed_date: string; days_before_pickup: number; offer_count: number
    min_daily_price: number; median_daily_price: number; max_daily_price: number
}
interface VehicleRow {
    vehicle_class: string | null; vehicle_name_raw: string; acriss_code: string | null
    seats: number | null; bags: number | null; transmission: string; fuel_type: string
    supplier: string | null; channel: string; availability: string
    daily_price: number | null; total_price: number | null; lead_time_days: number
    vehicle_class_method: string
}
interface CollectionError {
    id: number; source_code: string; stage: string; message: string; occurred_at: string
}
interface RunRow {
    id: string; status: string; planned_jobs: number; succeeded_jobs: number
    failed_jobs: number; offers_collected: number; started_at: string | null
}

const money = (n: number | null | undefined) => (n == null ? '—' : `$${Number(n).toFixed(0)}`)
const when = (s: string | null | undefined) => {
    if (!s) return '从未'
    const d = new Date(s)
    const mins = Math.round((Date.now() - d.getTime()) / 60000)
    if (mins < 60) return `${mins} 分钟前`
    if (mins < 1440) return `${Math.round(mins / 60)} 小时前`
    return `${Math.round(mins / 1440)} 天前`
}

export default function MarketIntel({ token, showToast }: { token: string; showToast: (m: string) => void }) {
    const [loading, setLoading] = useState(true)
    const [installed, setInstalled] = useState(true)
    const [installMessage, setInstallMessage] = useState('')

    const [summary, setSummary] = useState<Summary | null>(null)
    const [sources, setSources] = useState<SourceHealth[]>([])
    const [market, setMarket] = useState<MarketRow[]>([])
    const [marketDate, setMarketDate] = useState<string | null>(null)
    const [marketPickup, setMarketPickup] = useState<string | null>(null)
    const [vehicles, setVehicles] = useState<VehicleRow[]>([])
    const [expanded, setExpanded] = useState<string | null>(null)
    const [pickupDates, setPickupDates] = useState<PickupDate[]>([])
    const [errors, setErrors] = useState<CollectionError[]>([])
    const [runs, setRuns] = useState<RunRow[]>([])

    const [duration, setDuration] = useState(5)
    const [curvePickup, setCurvePickup] = useState<string>('')
    const [curveClass, setCurveClass] = useState<string>('MIDSIZE_SUV')
    const [curve, setCurve] = useState<CurvePoint[]>([])
    const [curveLoading, setCurveLoading] = useState(false)

    const headers = useMemo(() => ({ 'x-admin-token': token }), [token])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const pickupParam = marketPickup ? `&pickup=${marketPickup}` : ''
            const res = await fetch(`${API}?view=overview&duration=${duration}${pickupParam}`, { headers })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)

            if (json.installed === false) {
                setInstalled(false)
                setInstallMessage(json.error ?? '')
                return
            }
            setInstalled(true)
            setSummary(json.summary)
            setSources(json.sources ?? [])
            setMarket(json.market ?? [])
            setMarketDate(json.marketObservedDate ?? null)
            setMarketPickup(json.marketPickupDate ?? null)
            setPickupDates(json.pickupDates ?? [])
            setErrors(json.errors ?? [])
            setRuns(json.runs ?? [])

            // default the chart to the pickup date with the most history
            const best = [...(json.pickupDates ?? [])].sort(
                (a: PickupDate, b: PickupDate) => b.observation_days - a.observation_days,
            )[0]
            if (best && !curvePickup) setCurvePickup(best.pickup_date)
        } catch (e: any) {
            showToast('⚠️ ' + e.message)
        } finally {
            setLoading(false)
        }
    }, [headers, duration, marketPickup, curvePickup, showToast])

    useEffect(() => { load() }, [duration, marketPickup]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!marketPickup) return
        let cancelled = false
        const observed = marketDate ? `&observed=${marketDate}` : ''
        fetch(`${API}?view=vehicles&pickup=${marketPickup}&duration=${duration}${observed}`, { headers })
            .then((r) => r.json())
            .then((json) => { if (!cancelled) setVehicles(json.vehicles ?? []) })
            .catch(() => { /* the class table still works without the detail */ })
        return () => { cancelled = true }
    }, [marketPickup, marketDate, duration, headers])

    useEffect(() => {
        if (!curvePickup || !curveClass) return
        let cancelled = false
        setCurveLoading(true)
        fetch(`${API}?view=curve&pickup=${curvePickup}&class=${curveClass}&duration=${duration}`, { headers })
            .then((r) => r.json())
            .then((json) => { if (!cancelled) setCurve(json.curve ?? []) })
            .catch((e) => showToast('⚠️ ' + e.message))
            .finally(() => { if (!cancelled) setCurveLoading(false) })
        return () => { cancelled = true }
    }, [curvePickup, curveClass, duration, headers, showToast])

    if (!installed) {
        return (
            <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-amber-800">
                        <AlertTriangle size={18} /> 数据库还没初始化
                    </div>
                    <p className="text-[13px] leading-relaxed text-amber-900">{installMessage}</p>
                    <pre className="mt-4 overflow-x-auto rounded-lg bg-white/70 p-3 text-[12px] text-navy">
{`cd market-intel
cp .env.example .env      # 填 DATABASE_URL
npm install
npm run mi -- migrate
npm run mi -- sources:sync`}
                    </pre>
                </div>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-[1180px] px-5 py-7 sm:px-8 sm:py-10">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[2px] text-orange">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange" /> Market intelligence
                    </div>
                    <h2 className="font-syne text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold leading-tight text-navy">竞品价格监控</h2>
                    <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-muted">
                        自动采集的竞品报价。价格只追加不覆盖，所以可以看到同一个取车日期随着临近的涨跌曲线。
                        采集由 market-intel 服务运行，这里只读。
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="rounded-xl border border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy"
                    >
                        {[1, 3, 5, 7].map((d) => <option key={d} value={d}>租期 {d} 天</option>)}
                    </select>
                    <button
                        onClick={load}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> 刷新
                    </button>
                </div>
            </div>

            {/* ---- KPI row ---- */}
            <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="观测记录" value={summary?.observations?.toLocaleString() ?? '0'}
                     hint={summary?.observations_24h ? `24小时内 +${summary.observations_24h.toLocaleString()}` : '24小时内无新增'}
                     icon={Database} tone="bg-sky-50 text-sky-700" />
                <Kpi label="活跃数据源" value={String(summary?.active_sources ?? 0)}
                     hint={summary?.disabled_sources ? `${summary.disabled_sources} 个已自动停用` : '全部正常'}
                     icon={summary?.disabled_sources ? CircleX : CircleCheck}
                     tone={summary?.disabled_sources ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'} />
                <Kpi label="最近采集" value={when(summary?.last_observed_at)}
                     hint={summary?.pending_jobs ? `${summary.pending_jobs} 个任务排队中` : '队列空闲'}
                     icon={Clock} tone="bg-violet-50 text-violet-700" />
                <Kpi label="待人工分类" value={String(summary?.unresolved_vehicles ?? 0)}
                     hint={summary?.failed_jobs_24h ? `24小时内 ${summary.failed_jobs_24h} 个任务失败` : '无失败任务'}
                     icon={AlertTriangle}
                     tone={summary?.unresolved_vehicles ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'} />
            </div>

            {/* ---- booking curve ---- */}
            <section className="mb-7 rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-orange" />
                        <h3 className="font-syne text-[17px] font-extrabold text-navy">提前期价格曲线</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={curvePickup} onChange={(e) => setCurvePickup(e.target.value)}
                                className="rounded-lg border border-navy/15 bg-white px-2.5 py-1.5 text-[12px] text-navy">
                            {pickupDates.length === 0 && <option value="">暂无数据</option>}
                            {pickupDates.map((p) => (
                                <option key={p.pickup_date} value={p.pickup_date}>
                                    取车 {p.pickup_date}（{p.observation_days} 个观测日）
                                </option>
                            ))}
                        </select>
                        <select value={curveClass} onChange={(e) => setCurveClass(e.target.value)}
                                className="rounded-lg border border-navy/15 bg-white px-2.5 py-1.5 text-[12px] text-navy">
                            {Object.entries(CLASS_LABELS).map(([code, label]) => (
                                <option key={code} value={code}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <CurveChart points={curve} loading={curveLoading} />
            </section>

            {/* ---- market snapshot ---- */}
            <section className="mb-7 rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="font-syne text-[17px] font-extrabold text-navy">市场快照 · 按车型分类</h3>
                        <p className="mt-1 text-[12px] text-muted">
                            点开任意一行，看这个分类底下的具体车型和各自的报价。
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={marketPickup ?? ''}
                            onChange={(e) => { setMarketPickup(e.target.value); setExpanded(null) }}
                            className="rounded-lg border border-navy/15 bg-white px-2.5 py-1.5 text-[12px] text-navy"
                        >
                            {pickupDates.length === 0 && <option value="">暂无数据</option>}
                            {pickupDates.map((p) => (
                                <option key={p.pickup_date} value={p.pickup_date}>
                                    取车 {p.pickup_date}（提前 {p.min_lead_time_days} 天）
                                </option>
                            ))}
                        </select>
                        <span className="text-[12px] text-muted">
                            {marketDate ? `观测日 ${marketDate}` : ''}
                        </span>
                    </div>
                </div>

                {market.length === 0 ? (
                    <Empty>还没有采集到数据。运行 <code className="rounded bg-navy/5 px-1">npm run mi -- jobs:generate</code> 开始采集。</Empty>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[680px] text-[13px]">
                            <thead>
                                <tr className="border-b border-navy/10 text-left text-[11px] uppercase tracking-wide text-muted">
                                    <th className="pb-2 font-semibold">车型分类</th>
                                    <th className="pb-2 text-right font-semibold">最低</th>
                                    <th className="pb-2 text-right font-semibold">中位数</th>
                                    <th className="pb-2 text-right font-semibold">最高</th>
                                    <th className="pb-2 text-right font-semibold">车型数</th>
                                    <th className="pb-2 text-right font-semibold">供应商</th>
                                </tr>
                            </thead>
                            <tbody>
                                {market.map((row) => {
                                    const models = vehicles.filter((v) => v.vehicle_class === row.vehicle_class)
                                    const open = expanded === row.vehicle_class
                                    return (
                                        <React.Fragment key={row.vehicle_class}>
                                            <tr
                                                onClick={() => setExpanded(open ? null : row.vehicle_class)}
                                                className="cursor-pointer border-b border-navy/5 hover:bg-orange/5"
                                            >
                                                <td className="py-2.5 font-semibold text-navy">
                                                    <span className="flex items-center gap-1.5">
                                                        {open ? <ChevronDown size={14} className="text-orange" />
                                                              : <ChevronRight size={14} className="text-muted" />}
                                                        {CLASS_LABELS[row.vehicle_class] ?? row.vehicle_class}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 text-right tabular-nums text-emerald-700">{money(row.min_daily_price)}</td>
                                                <td className="py-2.5 text-right font-bold tabular-nums text-navy">{money(row.median_daily_price)}</td>
                                                <td className="py-2.5 text-right tabular-nums text-rose-700">{money(row.max_daily_price)}</td>
                                                <td className="py-2.5 text-right tabular-nums text-muted">{models.length || row.offer_count}</td>
                                                <td className="py-2.5 text-right tabular-nums text-muted">{row.supplier_count}</td>
                                            </tr>
                                            {open && (
                                                <tr className="border-b border-navy/5 bg-slate-50/70">
                                                    <td colSpan={6} className="px-2 py-3">
                                                        {models.length === 0 ? (
                                                            <div className="px-2 text-[12px] text-muted">这个分类没有车型明细。</div>
                                                        ) : (
                                                            <div className="space-y-1">
                                                                {models.map((m, i) => (
                                                                    <div key={`${m.vehicle_name_raw}-${i}`}
                                                                         className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                                                                        <div className="min-w-[240px] flex-1">
                                                                            <div className="font-semibold text-navy">{m.vehicle_name_raw}</div>
                                                                            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted">
                                                                                {m.acriss_code && <span className="font-mono">{m.acriss_code}</span>}
                                                                                {m.seats != null && <span>{m.seats} 座</span>}
                                                                                {m.bags != null && <span>{m.bags} 件行李</span>}
                                                                                <span>{m.transmission === 'automatic' ? '自动' : m.transmission === 'manual' ? '手动' : '未知'}</span>
                                                                                <span>{FUEL_LABELS[m.fuel_type] ?? m.fuel_type}</span>
                                                                                {m.supplier && <span>供应商 {m.supplier}</span>}
                                                                                {m.vehicle_class_method === 'unresolved' && (
                                                                                    <span className="text-amber-700">未分类</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            {m.availability === 'available' ? (
                                                                                <>
                                                                                    <div className="font-syne text-[15px] font-extrabold text-navy">
                                                                                        {money(m.daily_price)}<span className="text-[11px] font-normal text-muted">/天</span>
                                                                                    </div>
                                                                                    <div className="text-[11px] text-muted">总价 {money(m.total_price)}</div>
                                                                                </>
                                                                            ) : (
                                                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                                                                    已租完
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                        {market.length > 0 && market[0].supplier_count < 3 && (
                            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                                目前只有 {market[0].supplier_count} 个供应商的数据，中位数还不能代表市场。建议至少接入 3–5 家竞品。
                            </p>
                        )}
                    </div>
                )}
            </section>

            {/* ---- source health ---- */}
            <section className="mb-7 rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
                <h3 className="mb-4 font-syne text-[17px] font-extrabold text-navy">数据源健康</h3>
                {sources.length === 0 ? (
                    <Empty>还没有同步数据源。运行 <code className="rounded bg-navy/5 px-1">npm run mi -- sources:sync</code>。</Empty>
                ) : (
                    <div className="space-y-2">
                        {sources.map((s) => {
                            const bad = s.auto_disabled || s.errors_24h > 0
                            return (
                                <div key={s.source_code}
                                     className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                                         s.auto_disabled ? 'border-rose-200 bg-rose-50'
                                             : !s.enabled ? 'border-navy/10 bg-slate-50'
                                             : 'border-navy/10 bg-white'}`}>
                                    <div className="min-w-[180px]">
                                        <div className="flex items-center gap-2">
                                            <span className={`h-2 w-2 rounded-full ${
                                                s.auto_disabled ? 'bg-rose-500' : s.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                            <span className="font-semibold text-navy">{s.name}</span>
                                            <span className="rounded bg-navy/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                                                {s.source_type === 'ota' ? 'OTA' : '直营'}
                                            </span>
                                        </div>
                                        {s.auto_disabled && (
                                            <div className="mt-1 text-[11px] text-rose-700">已自动停用：{s.auto_disabled_reason}</div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
                                        <span>24h 报价 <b className="text-navy">{s.offers_24h}</b></span>
                                        <span>排队 <b className="text-navy">{s.pending_jobs}</b></span>
                                        <span className={s.errors_24h ? 'text-rose-700' : ''}>24h 错误 <b>{s.errors_24h}</b></span>
                                        <span className={s.unclassified_7d ? 'text-amber-700' : ''}>7天未分类 <b>{s.unclassified_7d}</b></span>
                                        <span>最近成功 <b className="text-navy">{when(s.last_success_at)}</b></span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* ---- runs + errors ---- */}
            <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
                    <h3 className="mb-4 font-syne text-[17px] font-extrabold text-navy">最近采集批次</h3>
                    {runs.length === 0 ? <Empty>还没有采集批次。</Empty> : (
                        <div className="space-y-2 text-[12px]">
                            {runs.map((r) => (
                                <div key={r.id} className="flex items-center justify-between gap-3 border-b border-navy/5 pb-2 last:border-0">
                                    <div>
                                        <div className="font-semibold text-navy">{when(r.started_at)}</div>
                                        <div className="text-muted">{r.succeeded_jobs}/{r.planned_jobs} 完成 · {r.offers_collected} 条报价</div>
                                    </div>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        r.status === 'completed' ? 'bg-emerald-50 text-emerald-700'
                                            : r.failed_jobs > 0 ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'}`}>
                                        {r.status === 'completed' ? '完成' : r.status === 'running' ? '进行中' : r.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
                    <h3 className="mb-4 font-syne text-[17px] font-extrabold text-navy">最近错误</h3>
                    {errors.length === 0 ? <Empty>没有错误记录。</Empty> : (
                        <div className="space-y-2 text-[12px]">
                            {errors.map((e) => (
                                <div key={e.id} className="border-b border-navy/5 pb-2 last:border-0">
                                    <div className="flex items-center gap-2">
                                        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">{e.stage}</span>
                                        <span className="font-semibold text-navy">{e.source_code}</span>
                                        <span className="text-muted">{when(e.occurred_at)}</span>
                                    </div>
                                    <div className="mt-1 line-clamp-2 text-muted">{e.message}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}

function Kpi({ label, value, hint, icon: Icon, tone }: {
    label: string; value: string; hint: string; icon: React.ElementType; tone: string
}) {
    return (
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}><Icon size={15} /></span>
            </div>
            <div className="font-syne text-[22px] font-extrabold leading-none text-navy">{value}</div>
            <div className="mt-1.5 text-[11px] text-muted">{hint}</div>
        </div>
    )
}

function Empty({ children }: { children: React.ReactNode }) {
    return <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-[13px] text-muted">{children}</div>
}

/**
 * The booking curve. X axis is days before pickup, running right-to-left so
 * time reads left-to-right: far out on the left, pickup day on the right.
 * Inline SVG — no chart dependency added to the site bundle.
 */
function CurveChart({ points, loading }: { points: CurvePoint[]; loading: boolean }) {
    if (loading) return <div className="h-[260px] animate-pulse rounded-xl bg-slate-50" />
    if (points.length === 0) {
        return <Empty>这个取车日期还没有足够的观测数据。每天采集一次，几天后曲线就会出现。</Empty>
    }

    const W = 720, H = 260, PAD = { top: 16, right: 16, bottom: 34, left: 46 }
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom

    const sorted = [...points].sort((a, b) => b.days_before_pickup - a.days_before_pickup)
    const xs = sorted.map((p) => p.days_before_pickup)
    const maxDays = Math.max(...xs, 1)
    const minDays = Math.min(...xs, 0)
    const prices = sorted.flatMap((p) => [p.min_daily_price, p.max_daily_price]).filter((v) => v != null)
    const maxPrice = Math.max(...prices) * 1.1
    const minPrice = Math.min(...prices) * 0.9

    const x = (days: number) =>
        PAD.left + (maxDays === minDays ? plotW / 2 : ((maxDays - days) / (maxDays - minDays)) * plotW)
    const y = (price: number) =>
        PAD.top + (maxPrice === minPrice ? plotH / 2 : (1 - (price - minPrice) / (maxPrice - minPrice)) * plotH)

    const line = (get: (p: CurvePoint) => number) =>
        sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.days_before_pickup).toFixed(1)} ${y(get(p)).toFixed(1)}`).join(' ')

    const band =
        sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.days_before_pickup).toFixed(1)} ${y(p.max_daily_price).toFixed(1)}`).join(' ') +
        ' ' +
        [...sorted].reverse().map((p) => `L ${x(p.days_before_pickup).toFixed(1)} ${y(p.min_daily_price).toFixed(1)}`).join(' ') +
        ' Z'

    const ticks = 4
    const gridY = Array.from({ length: ticks + 1 }, (_, i) => minPrice + ((maxPrice - minPrice) * i) / ticks)

    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const change = first.median_daily_price > 0
        ? ((last.median_daily_price - first.median_daily_price) / first.median_daily_price) * 100
        : 0

    return (
        <div>
            <div className="overflow-x-auto">
                <svg viewBox={`0 0 ${W} ${H}`} className="h-[260px] w-full min-w-[560px]" role="img"
                     aria-label="提前期价格曲线">
                    {gridY.map((price, i) => (
                        <g key={i}>
                            <line x1={PAD.left} x2={W - PAD.right} y1={y(price)} y2={y(price)}
                                  stroke="currentColor" className="text-navy/10" strokeWidth="1" />
                            <text x={PAD.left - 8} y={y(price) + 4} textAnchor="end"
                                  className="fill-current text-[10px] text-muted">${price.toFixed(0)}</text>
                        </g>
                    ))}

                    {/* min-max band */}
                    <path d={band} className="fill-current text-orange/10" />
                    {/* min / max edges */}
                    <path d={line((p) => p.min_daily_price)} fill="none" className="stroke-current text-emerald-500/60"
                          strokeWidth="1.5" strokeDasharray="4 3" />
                    <path d={line((p) => p.max_daily_price)} fill="none" className="stroke-current text-rose-400/60"
                          strokeWidth="1.5" strokeDasharray="4 3" />
                    {/* median */}
                    <path d={line((p) => p.median_daily_price)} fill="none" className="stroke-current text-orange"
                          strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                    {sorted.map((p) => (
                        <g key={p.observed_date}>
                            <circle cx={x(p.days_before_pickup)} cy={y(p.median_daily_price)} r="3.5"
                                    className="fill-current text-orange" />
                            <title>{`观测 ${p.observed_date} · 提前 ${p.days_before_pickup} 天\n中位 $${p.median_daily_price?.toFixed(0)}/天（$${p.min_daily_price?.toFixed(0)}–$${p.max_daily_price?.toFixed(0)}）\n${p.offer_count} 条报价`}</title>
                        </g>
                    ))}

                    {sorted.map((p, i) => (
                        i % Math.ceil(sorted.length / 6) === 0 || i === sorted.length - 1 ? (
                            <text key={p.observed_date} x={x(p.days_before_pickup)} y={H - PAD.bottom + 18}
                                  textAnchor="middle" className="fill-current text-[10px] text-muted">
                                {p.days_before_pickup}天
                            </text>
                        ) : null
                    ))}
                    <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-current text-[10px] text-muted">
                        ← 距离取车天数（越往右越接近取车日）
                    </text>
                </svg>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-orange" />中位价</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-emerald-500/60" />最低价</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-rose-400/60" />最高价</span>
                <span className="text-muted">
                    从提前 {first.days_before_pickup} 天到 {last.days_before_pickup} 天，中位价
                    <b className={change >= 0 ? 'text-rose-700' : 'text-emerald-700'}>
                        {' '}{change >= 0 ? '+' : ''}{change.toFixed(1)}%
                    </b>
                </span>
            </div>
        </div>
    )
}
