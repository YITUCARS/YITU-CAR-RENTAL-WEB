'use client'

import { useEffect, useState } from 'react'

type Account = {
  id: string
  username: string
  display_name: string
  active: boolean
  discount_percent?: number
  last_login_at?: string | null
}

function money(value: unknown) {
  return Number(value || 0).toFixed(2)
}

function BookingDetail({ booking }: { booking: any }) {
  const breakdown = booking.pricing_breakdown || {}
  const discount = Number(booking.original_total || 0) - Number(booking.partner_total || 0)

  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.07] bg-[#f8f8f6] px-4 py-3">
        <div><div className="font-bold text-navy">{booking.vehicle_name || 'Vehicle'}</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-[1.4px] text-muted">Booking detail</div></div>
        <span className="rounded-full bg-navy px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">{booking.reference}</span>
      </div>
      <div className="grid gap-2 px-4 py-3 text-muted sm:grid-cols-2">
        <div>取车：{booking.pickup_date} {booking.pickup_time} · {booking.pickup_location || '—'}</div>
        <div>还车：{booking.dropoff_date} {booking.dropoff_time} · {booking.dropoff_location || '—'}</div>
        <div>RCM：{booking.rcm_reservation_ref || '—'} {booking.rcm_reservation_no ? `(#${booking.rcm_reservation_no})` : ''}</div>
      </div>
      <div className="mx-4 mb-4 rounded-xl border border-black/[0.07] bg-[#fbfbfa] px-3 py-2.5 text-muted">
        <div className="flex justify-between"><span>原价</span><span>NZD ${money(booking.original_total)}</span></div>
        {breakdown.vehicle !== undefined && <div className="flex justify-between"><span>车辆</span><span>NZD ${money(breakdown.vehicle)}</span></div>}
        {breakdown.insurance !== undefined && <div className="flex justify-between"><span>保险</span><span>NZD ${money(breakdown.insurance)}</span></div>}
        {breakdown.mandatoryFees !== undefined && <div className="flex justify-between"><span>强制费用</span><span>NZD ${money(breakdown.mandatoryFees)}</span></div>}
        {breakdown.youngDriver !== undefined && Number(breakdown.youngDriver) > 0 && <div className="flex justify-between"><span>Young driver</span><span>NZD ${money(breakdown.youngDriver)}</span></div>}
        {breakdown.optionalExtras !== undefined && <div className="flex justify-between"><span>附加项</span><span>NZD ${money(breakdown.optionalExtras)}</span></div>}
        {breakdown.promoDiscount !== undefined && Number(breakdown.promoDiscount) > 0 && <div className="flex justify-between text-green-700"><span>优惠码折扣</span><span>- NZD ${money(breakdown.promoDiscount)}</span></div>}
        {discount > 0 && <div className="flex justify-between text-green-700"><span>企业优惠</span><span>- NZD ${money(discount)}</span></div>}
        <div className="mt-2 flex justify-between border-t border-black/10 pt-2.5 font-bold text-orange">
          <span>企业结算价</span><span>NZD ${money(booking.partner_total)}</span>
        </div>
      </div>
    </div>
  )
}

export default function PartnerAccounts({ token, showToast }: { token: string; showToast: (message: string) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [statements, setStatements] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [openStatement, setOpenStatement] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ username: '', displayName: '', password: '', discountPercent: '0', notes: '' })
  const [loading, setLoading] = useState(true)
  const headers = { 'x-admin-token': token, 'Content-Type': 'application/json' }

  async function load() {
    const accountResponse = await fetch('/api/admin/partner-accounts', { headers })
    const accountData = await accountResponse.json()
    if (accountData.success) setAccounts(accountData.accounts)
    const statementResponse = await fetch('/api/admin/partner-statements', { headers })
    const statementData = await statementResponse.json()
    if (statementResponse.ok) {
      setStatements(statementData.statements || [])
      setBookings(statementData.bookings || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create() {
    const response = await fetch('/api/admin/partner-accounts', { method: 'POST', headers, body: JSON.stringify(form) })
    const data = await response.json()
    if (!response.ok) return showToast(data.error || '创建失败')
    setForm({ username: '', displayName: '', password: '', discountPercent: '0', notes: '' })
    showToast('合作伙伴账号已创建')
    load()
  }

  async function toggle(account: Account) {
    await fetch(`/api/admin/partner-accounts/${account.id}`, { method: 'PATCH', headers, body: JSON.stringify({ active: !account.active }) })
    load()
  }

  async function saveDiscount(account: Account, value: string) {
    const discountPercent = Math.min(100, Math.max(0, Number(value || 0)))
    await fetch(`/api/admin/partner-accounts/${account.id}`, { method: 'PATCH', headers, body: JSON.stringify({ discountPercent }) })
    showToast('优惠已保存')
    load()
  }

  async function remove(account: Account) {
    if (!confirm(`删除 ${account.username}？`)) return
    await fetch(`/api/admin/partner-accounts/${account.id}`, { method: 'DELETE', headers })
    showToast('账号已删除')
    load()
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 lg:py-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-navy px-6 py-6 text-white shadow-[0_18px_45px_rgba(10,25,55,0.12)] sm:px-8">
        <div><div className="text-[11px] font-bold uppercase tracking-[2px] text-orange">Partner Portal</div><h2 className="mt-1 font-syne text-2xl font-extrabold">合作伙伴管理</h2><p className="mt-2 max-w-xl text-sm text-white/65">管理企业账号、专属优惠，以及每个月的车辆预订结算。</p></div>
        <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-right"><div className="text-2xl font-extrabold">{accounts.length}</div><div className="text-[11px] text-white/60">合作伙伴账号</div></div>
      </div>

      <div className="space-y-6">
        <section className="rounded-3xl border border-black/[0.08] bg-white p-5 shadow-sm sm:p-6">
          <button type="button" onClick={() => setCreateOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left"><div><div className="text-[10px] font-bold uppercase tracking-[1.5px] text-orange">New partner</div><h3 className="mt-1 font-syne text-lg font-extrabold text-navy">创建合作伙伴账号</h3><p className="mt-1 text-xs text-muted">需要创建新企业账号时，再展开填写。</p></div><span className="rounded-xl bg-orange/10 px-3 py-2 text-xs font-bold text-orange">{createOpen ? '收起' : '+ 展开创建'}</span></button>
          {createOpen && <div className="mt-4 space-y-3">
            {([
              ['username', '登录账号'], ['displayName', '显示名称'], ['password', '初始密码'],
              ['discountPercent', '优惠百分比'], ['notes', '备注'],
            ] as const).map(([key, label]) => (
              <label key={key} className="block text-xs font-bold text-muted">
                {label}
                <input
                  type={key === 'password' ? 'password' : key === 'discountPercent' ? 'number' : 'text'}
                  min={key === 'discountPercent' ? 0 : undefined}
                  max={key === 'discountPercent' ? 100 : undefined}
                  value={form[key]}
                  onChange={event => setForm({ ...form, [key]: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-orange"
                />
              </label>
            ))}
            <p className="text-[11px] text-muted">例如填写 15，企业用户看到 15% 优惠价格。</p>
            <button onClick={create} className="w-full rounded-xl bg-orange px-4 py-3 text-sm font-bold text-white shadow-[0_8px_18px_rgba(234,117,48,0.2)] transition hover:-translate-y-0.5">创建账号</button>
          </div>}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1"><div><h3 className="font-syne text-lg font-extrabold text-navy">账号列表</h3><p className="mt-0.5 text-xs text-muted">设置优惠比例并管理登录状态</p></div><span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-bold text-muted">{accounts.filter(account => account.active).length} 个启用</span></div>
          {loading ? <div className="rounded-2xl bg-white p-5 text-sm text-muted">加载中…</div> : accounts.length === 0 ? <div className="rounded-2xl bg-white p-5 text-sm text-muted">还没有合作伙伴账号。</div> : accounts.map(account => (
            <div key={account.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm transition hover:border-orange/30">
              <div className="flex min-w-[200px] items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy font-syne font-extrabold text-white">{account.display_name.slice(0, 1).toUpperCase()}</div><div><div className="font-bold text-navy">{account.display_name} <span className="ml-1 text-xs font-normal text-muted">@{account.username}</span></div><div className="mt-1 flex items-center gap-1.5 text-xs text-muted"><span className={`h-1.5 w-1.5 rounded-full ${account.active ? 'bg-green-500' : 'bg-black/25'}`} />{account.active ? '账号启用中' : '账号已停用'}{account.last_login_at ? ` · 上次登录 ${new Date(account.last_login_at).toLocaleString()}` : ''}</div></div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center rounded-xl border border-orange/20 bg-orange/[0.04] px-2.5 py-1.5 text-xs font-bold text-orange">优惠 <input defaultValue={account.discount_percent || 0} onBlur={event => saveDiscount(account, event.target.value)} type="number" min={0} max={100} className="ml-1 w-12 bg-transparent text-center text-xs outline-none" />%</label>
                <button onClick={() => toggle(account)} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-bold transition hover:bg-black/[0.03]">{account.active ? '停用' : '启用'}</button>
                <button onClick={() => remove(account)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">删除</button>
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-black/[0.08] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[1.5px] text-orange">Billing overview</div><h3 className="mt-1 font-syne text-xl font-extrabold text-navy">月度 Statement</h3><p className="mt-1 text-xs text-muted">点击详情查看该公司当月每一笔订单及价格 breakdown。</p></div><div className="rounded-xl bg-[#f8f8f6] px-3 py-2 text-xs font-bold text-muted">{statements.length} 个月份</div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statements.map((statement: any) => {
            const account = accounts.find(item => item.id === statement.partnerAccountId)
            const key = `${statement.partnerAccountId}-${statement.month}`
            const details = bookings.filter(booking => booking.partner_account_id === statement.partnerAccountId && String(booking.pickup_date || booking.created_at).slice(0, 7) === statement.month)
            const open = openStatement === key
            return (
              <div key={key} className="rounded-2xl border border-black/[0.08] bg-[#fcfcfb] p-4 sm:col-span-2 lg:col-span-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-bold text-navy"><span>{account?.display_name || '企业账号'}</span><span className="rounded-full bg-orange/10 px-2 py-0.5 text-[10px] text-orange">{statement.month}</span></div>
                    <div className="mt-1 text-xs text-muted">{statement.bookings} 辆车 · {details.length} 笔明细</div>
                  </div>
                  <button onClick={() => setOpenStatement(open ? '' : key)} className="rounded-xl bg-navy px-3.5 py-2 text-xs font-bold text-white transition hover:bg-navy/90">{open ? '收起详情' : '查看详情 →'}</button>
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-2"><div><div className="text-[10px] font-bold uppercase tracking-[1.3px] text-muted">Partner total</div><div className="mt-1 font-syne text-2xl font-extrabold text-orange">NZD ${money(statement.total)}</div></div><div><div className="text-[10px] font-bold uppercase tracking-[1.3px] text-muted">Original total</div><div className="mt-1 text-sm font-bold text-muted">NZD ${money(statement.originalTotal)}</div></div></div>
                {open && <div className="mt-4 grid gap-3 border-t border-black/10 pt-4 md:grid-cols-2">{details.length ? details.map(booking => <BookingDetail key={booking.id} booking={booking} />) : <p className="text-sm text-muted">该月份没有找到订单明细。</p>}</div>}
              </div>
            )
          })}
        </div>
        {statements.length === 0 && <p className="mt-4 text-sm text-muted">暂无企业预订账单。</p>}
      </section>
    </div>
  )
}
