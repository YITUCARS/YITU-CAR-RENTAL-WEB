'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, RefreshCw, MapPin, CarFront, CircleAlert, CheckCircle2 } from 'lucide-react'

type Vehicle = { id: string; brand: string; model: string; category: string; seats?: number; active: boolean; image?: string }
type Booking = { id: string; pickupDate: string; dropoffDate: string; pickupTime: string; dropoffTime: string; pickupLocation: string; dropoffLocation: string; vehicle: string; plate: string; customer: string; status: string; source: string; total: string }
type ManualStatus = 'available' | 'maintenance' | 'unavailable'

const DAY_MS = 86400000
const dayValue = (date: Date) => date.toISOString().slice(0, 10)
const daysBetween = (from: string, to: string) => Math.max(1, Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / DAY_MS) + 1)
const addDays = (value: string, amount: number) => { const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return dayValue(d) }

function overlap(booking: Booking, date: string) {
  return Boolean(booking.pickupDate && booking.dropoffDate && booking.pickupDate <= date && booking.dropoffDate >= date)
}

function bookingMatches(booking: Booking, vehicle: Vehicle) {
  const haystack = `${booking.vehicle} ${booking.plate}`.toLowerCase()
  return Boolean(booking.plate) && haystack.includes(`${vehicle.brand} ${vehicle.model}`.toLowerCase()) || (booking.plate && haystack.includes(booking.plate.toLowerCase()))
}

function statusLabel(status: ManualStatus) {
  return status === 'maintenance' ? '维护' : status === 'unavailable' ? '停用' : '可用'
}

export default function AvailabilityBoard({ token, showToast }: { token: string; showToast: (message: string) => void }) {
  const now = new Date()
  const initialFrom = dayValue(now)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(addDays(initialFrom, 13))
  const [location, setLocation] = useState('全部地点')
  const [category, setCategory] = useState('全部车型')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [sources, setSources] = useState({ local: 0, agent: 0, agentError: '' })
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Booking | null>(null)
  const [manualStatuses, setManualStatuses] = useState<Record<string, ManualStatus>>({})
  const [autoAllocateLoading, setAutoAllocateLoading] = useState(false)
  const [autoAllocateMessage, setAutoAllocateMessage] = useState('')

  useEffect(() => {
    try { setManualStatuses(JSON.parse(localStorage.getItem('yitu-availability-statuses') || '{}')) } catch { /* ignore malformed local state */ }
  }, [])

  function cycleStatus(vehicleId: string, date: string) {
    const key = `${vehicleId}:${date}`
    const current = manualStatuses[key] || 'available'
    const nextStatus: ManualStatus = current === 'available' ? 'maintenance' : current === 'maintenance' ? 'unavailable' : 'available'
    const next = { ...manualStatuses, [key]: nextStatus }
    setManualStatuses(next)
    localStorage.setItem('yitu-availability-statuses', JSON.stringify(next))
  }

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/availability?from=${from}&to=${to}`, { headers: { 'x-admin-token': token } })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '加载失败')
      setVehicles(data.vehicles || [])
      setBookings(data.bookings || [])
      setSources(data.sources || { local: 0, agent: 0, agentError: '' })
    } catch (error: any) { showToast(`可用性加载失败：${error.message}`) } finally { setLoading(false) }
  }

  async function autoAllocateSelected() {
    if (!selected) return
    setAutoAllocateLoading(true)
    setAutoAllocateMessage('正在请求 RCM 分配车辆...')
    try {
      const response = await fetch('/api/admin/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ reservationRef: selected.id }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'RCM 分配失败')
      setAutoAllocateMessage('RCM 已接受 Auto-Allocate 请求，正在刷新订单状态。')
      await load()
    } catch (error: any) {
      setAutoAllocateMessage(`Auto-Allocate 未完成：${error.message}`)
    } finally {
      setAutoAllocateLoading(false)
    }
  }

  useEffect(() => { load() }, [from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  const dates = useMemo(() => Array.from({ length: Math.min(31, daysBetween(from, to)) }, (_, index) => addDays(from, index)), [from, to])
  const categories = useMemo(() => Array.from(new Set(vehicles.map(vehicle => vehicle.category).filter(Boolean))), [vehicles])
  const locations = useMemo(() => Array.from(new Set(bookings.flatMap(booking => [booking.pickupLocation, booking.dropoffLocation]).filter(Boolean))), [bookings])
  const filteredVehicles = vehicles.filter(vehicle => vehicle.active !== false && (category === '全部车型' || vehicle.category === category))
  const visibleBookings = bookings.filter(booking => location === '全部地点' || booking.pickupLocation === location || booking.dropoffLocation === location)
  const bookedCount = filteredVehicles.filter(vehicle => visibleBookings.some(booking => bookingMatches(booking, vehicle) && overlap(booking, from))).length
  const unassigned = visibleBookings.filter(booking => !filteredVehicles.some(vehicle => bookingMatches(booking, vehicle)))

  return <div className="px-5 py-6 sm:px-8">
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="mb-1 text-[11px] font-bold uppercase tracking-[1.8px] text-orange">Fleet availability</div><h1 className="font-syne text-2xl font-extrabold text-navy sm:text-3xl">车辆可用性</h1><p className="mt-1 text-[12px] text-muted">按日期查看车辆是否被预订，不再需要阅读复杂的后台时间轴。</p></div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />{loading ? '刷新中...' : '刷新数据'}</button>
      </div>
      <div className="grid gap-3 rounded-2xl border border-black/8 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11px] font-bold text-muted">开始日期<input type="date" value={from} onChange={event => { setFrom(event.target.value); if (to < event.target.value) setTo(addDays(event.target.value, 13)) }} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-navy outline-none focus:border-orange" /></label>
        <label className="text-[11px] font-bold text-muted">结束日期<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-navy outline-none focus:border-orange" /></label>
        <label className="text-[11px] font-bold text-muted">地点<select value={location} onChange={event => setLocation(event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-orange"><option>全部地点</option>{locations.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="text-[11px] font-bold text-muted">车型<select value={category} onChange={event => setCategory(event.target.value)} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-orange"><option>全部车型</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary icon={CarFront} label="车辆总数" value={filteredVehicles.length} tone="navy" /><Summary icon={CheckCircle2} label="开始日可用" value={Math.max(0, filteredVehicles.length - bookedCount)} tone="green" /><Summary icon={CircleAlert} label="开始日已占用" value={bookedCount} tone="orange" /><Summary icon={CalendarDays} label="时间范围" value={`${dates.length} 天`} tone="sky" />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-black/8 bg-off-white px-4 py-3 text-[11px] text-muted"><span className="font-bold text-navy">图例</span><Legend color="bg-orange" label="已预订" /><Legend color="bg-sky-500" label="渠道订单" /><Legend color="bg-amber-500" label="维护" /><Legend color="bg-red-500" label="停用" /><Legend color="bg-black/10" label="可用" /><span className="ml-auto">点击空白日期格可循环设置：可用 → 维护 → 停用</span></div>
      <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm">
        <div className="hidden min-w-[900px] md:block">
          <div className="grid grid-cols-[220px_repeat(var(--days),minmax(42px,1fr))] border-b border-black/10 bg-navy text-white" style={{ '--days': dates.length } as React.CSSProperties}><div className="sticky left-0 z-10 px-4 py-3 text-xs font-bold">车辆 / 位置</div>{dates.map(date => <div key={date} className="border-l border-white/10 px-1 py-2 text-center text-[10px] font-bold"><div>{new Date(`${date}T12:00:00Z`).toLocaleDateString('en-NZ', { weekday: 'short' })}</div><div className="mt-0.5 text-white/65">{date.slice(5)}</div></div>)}</div>
          {filteredVehicles.length === 0 ? <Empty /> : <div>{categories.filter(item => category === '全部车型' || item === category).map(group => <div key={group}><div className="border-b border-black/10 bg-navy/5 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide text-navy">{group}</div>{filteredVehicles.filter(vehicle => vehicle.category === group).map(vehicle => <TimelineRow key={vehicle.id} vehicle={vehicle} dates={dates} bookings={visibleBookings} manualStatuses={manualStatuses} onSelect={setSelected} onToggle={cycleStatus} />)}</div>)}</div>}
        </div>
        <div className="divide-y divide-black/8 md:hidden">{filteredVehicles.map(vehicle => <MobileRow key={vehicle.id} vehicle={vehicle} dates={dates} bookings={visibleBookings} manualStatuses={manualStatuses} onSelect={setSelected} onToggle={cycleStatus} />)}{filteredVehicles.length === 0 && <Empty />}</div>
      </div>
      {unassigned.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-sm font-extrabold text-amber-900"><CircleAlert size={16} />未绑定到具体车牌的订单 ({unassigned.length})</div><p className="mt-1 text-[11px] text-amber-800">这些订单只包含车型或类别，系统不会错误地标记某一台具体车辆。</p><div className="mt-3 flex flex-wrap gap-2">{unassigned.slice(0, 8).map(booking => <button type="button" key={booking.id} onClick={() => setSelected(booking)} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-[11px] text-amber-900">{booking.vehicle} · {booking.pickupDate}</button>)}</div></div>}
      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/35 p-4 sm:items-center" onClick={() => setSelected(null)}><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><div className="text-[11px] font-bold uppercase tracking-wide text-orange">订单详情</div><h2 className="mt-1 font-syne text-xl font-extrabold text-navy">{selected.vehicle}</h2></div><button type="button" onClick={() => { setSelected(null); setAutoAllocateMessage('') }} className="text-sm text-muted">关闭</button></div><div className="mt-4 space-y-2 text-sm text-navy"><p><b>客户：</b>{selected.customer}</p><p><b>取还：</b>{selected.pickupDate} {selected.pickupTime} → {selected.dropoffDate} {selected.dropoffTime}</p><p><b>地点：</b>{selected.pickupLocation || '—'} → {selected.dropoffLocation || '—'}</p><p><b>来源：</b>{selected.source} · <b>状态：</b>{selected.status}</p>{selected.plate && <p><b>车牌：</b>{selected.plate}</p>}{selected.total && <p><b>金额：</b>NZD {selected.total}</p>}</div><div className="mt-5 border-t border-black/8 pt-4"><button type="button" onClick={autoAllocateSelected} disabled={autoAllocateLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60"><CheckCircle2 size={16} />{autoAllocateLoading ? '处理中...' : 'Auto-Allocate 分配车辆'}</button><p className="mt-2 text-[11px] leading-relaxed text-muted">仅在你点击后向 RCM 发起一次分配请求，不会自动处理其他订单。</p>{autoAllocateMessage && <p className="mt-2 rounded-xl bg-off-white px-3 py-2 text-[11px] leading-relaxed text-navy">{autoAllocateMessage}</p>}</div></div></div>}
    </div>
  </div>
}

function Summary({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone: string }) { return <div className="rounded-2xl border border-black/8 bg-white p-4"><div className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone === 'green' ? 'bg-emerald-50 text-emerald-600' : tone === 'orange' ? 'bg-orange/10 text-orange' : tone === 'sky' ? 'bg-sky-50 text-sky-600' : 'bg-navy/8 text-navy'}`}><Icon size={16} /></div><div className="mt-3 font-syne text-2xl font-extrabold text-navy">{value}</div><div className="text-[11px] text-muted">{label}</div></div> }
function Legend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span> }
function Empty() { return <div className="px-5 py-14 text-center text-sm text-muted">暂无符合条件的车辆</div> }
function TimelineRow({ vehicle, dates, bookings, manualStatuses, onSelect, onToggle }: { vehicle: Vehicle; dates: string[]; bookings: Booking[]; manualStatuses: Record<string, ManualStatus>; onSelect: (booking: Booking) => void; onToggle: (vehicleId: string, date: string) => void }) { return <div className="grid grid-cols-[220px_repeat(var(--days),minmax(42px,1fr))] border-b border-black/8" style={{ '--days': dates.length } as React.CSSProperties}><div className="sticky left-0 z-10 flex min-w-0 items-center gap-2 bg-white px-4 py-3"><div className="min-w-0"><div className="truncate text-[12px] font-bold text-navy">{vehicle.brand} {vehicle.model}</div><div className="mt-0.5 text-[10px] text-muted">{vehicle.category} · {vehicle.seats || '—'} seats</div></div></div>{dates.map(date => { const booking = bookings.find(item => bookingMatches(item, vehicle) && overlap(item, date)); const status = manualStatuses[`${vehicle.id}:${date}`] || 'available'; const statusClass = status === 'maintenance' ? 'bg-amber-400 text-white' : status === 'unavailable' ? 'bg-red-500 text-white' : 'bg-black/[0.015] hover:bg-orange/5'; return <button type="button" key={date} onClick={() => booking ? onSelect(booking) : onToggle(vehicle.id, date)} className={`min-h-[56px] border-l border-black/8 transition-colors ${booking ? (booking.source === 'Agent API' ? 'bg-sky-400 hover:bg-sky-500' : 'bg-orange hover:bg-orange-dark') : statusClass}`} aria-label={booking ? `${booking.vehicle} ${booking.pickupDate}` : statusLabel(status)}>{booking && date === booking.pickupDate ? <span className="block truncate px-1 text-[9px] font-bold text-white">{booking.id}</span> : !booking && status !== 'available' ? <span className="block pt-2 text-[9px] font-bold">{statusLabel(status)}</span> : null}</button> })}</div> }
function MobileRow({ vehicle, dates, bookings, manualStatuses, onSelect, onToggle }: { vehicle: Vehicle; dates: string[]; bookings: Booking[]; manualStatuses: Record<string, ManualStatus>; onSelect: (booking: Booking) => void; onToggle: (vehicleId: string, date: string) => void }) { const relevant = bookings.filter(item => bookingMatches(item, vehicle)); return <div className="p-4"><div className="flex items-center justify-between"><div><div className="text-sm font-bold text-navy">{vehicle.brand} {vehicle.model}</div><div className="mt-0.5 text-[11px] text-muted">{vehicle.category} · {vehicle.seats || '—'} seats</div></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{relevant.length ? `${relevant.length} 个订单` : '可用'}</span></div><div className="mt-3 grid grid-cols-7 gap-1">{dates.slice(0, 14).map(date => { const booking = relevant.find(item => overlap(item, date)); const status = manualStatuses[`${vehicle.id}:${date}`] || 'available'; const statusClass = status === 'maintenance' ? 'bg-amber-400 text-white' : status === 'unavailable' ? 'bg-red-500 text-white' : 'bg-black/5 text-muted'; return <button type="button" key={date} onClick={() => booking ? onSelect(booking) : onToggle(vehicle.id, date)} className={`rounded-md py-2 text-center text-[9px] ${booking ? (booking.source === 'Agent API' ? 'bg-sky-400 text-white' : 'bg-orange text-white') : statusClass}`}><span className="block">{date.slice(5)}</span><span className="block">{booking ? '占用' : statusLabel(status)}</span></button> })}</div></div> }
