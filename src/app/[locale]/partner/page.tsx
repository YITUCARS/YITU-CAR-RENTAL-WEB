'use client'
import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'

export default function PartnerPortalPage() {
  const routeLocale = useLocale() as 'en' | 'zh'
  const [locale, setLocale] = useState<'en' | 'zh'>(routeLocale)
  const [account, setAccount] = useState<any>(null)
  const [profile, setProfile] = useState({ email: '', phone: '' })
  const [bookings, setBookings] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [cancelling, setCancelling] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('all')
  const zh = locale === 'zh'
  const text = (cn: string, en: string) => zh ? cn : en
  useEffect(() => {
    const saved = window.localStorage.getItem('yitu-partner-locale') as 'en' | 'zh' | null
    const browserLocale: 'en' | 'zh' = saved || (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en')
    setLocale(browserLocale)
    if (browserLocale !== routeLocale) window.location.replace(`/${browserLocale}/partner`)
  }, [routeLocale])
  function changeLocale(next: 'en' | 'zh') {
    window.localStorage.setItem('yitu-partner-locale', next)
    window.location.href = `/${next}/partner`
  }
  function formatDateTime(date: string, time: string) {
    if (!date) return '—'
    return `${date}${time ? ` ${time}` : ''}`
  }
  const statementMonths = Array.from(new Set(bookings.map((booking) => String(booking.pickup_date || booking.created_at || '').slice(0, 7)).filter(Boolean))).sort().reverse()
  const visibleBookings = selectedMonth === 'all'
    ? bookings
    : bookings.filter((booking) => String(booking.pickup_date || booking.created_at || '').slice(0, 7) === selectedMonth)

  useEffect(() => {
    fetch('/api/partner/session').then(r => r.json()).then(data => {
      if (!data.success) return (window.location.href = `/${locale}/partner/login`)
      setAccount(data.account)
      setProfile({ email: data.account.contactEmail || '', phone: data.account.contactPhone || '' })
      setEditingProfile(!(data.account.contactEmail && data.account.contactPhone))
      setLoadingProfile(false)
      fetch('/api/partner/bookings').then(r => r.json()).then(d => setBookings(d.bookings || []))
    }).catch(() => { setLoadingProfile(false); window.location.href = `/${locale}/partner/login` })
  }, [locale])

  async function saveProfile() {
    setMessage('')
    const response = await fetch('/api/partner/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
    const data = await response.json()
    if (!response.ok) return setMessage(data.error || text('保存失败', 'Unable to save details'))
    const savedEmail = data.profile?.contact_email || profile.email
    const savedPhone = data.profile?.contact_phone || profile.phone
    setProfile({ email: savedEmail, phone: savedPhone })
    setAccount((current: any) => ({ ...current, contactEmail: savedEmail, contactPhone: savedPhone }))
    setEditingProfile(false)
    setMessage(text('企业资料已保存，之后预订会自动使用。', 'Details saved. They will be used for future bookings.'))
  }

  async function logout() { await fetch('/api/partner/login', { method: 'DELETE' }); window.location.href = `/${locale}/partner/login` }

  async function cancelBooking(booking: any) {
    if (cancelling || String(booking.status).toLowerCase() === 'cancelled') return
    if (!window.confirm(zh ? `确定取消 ${booking.vehicle_name || '这台车辆'} 的企业预订吗？取消会同步到 RCM。` : `Cancel the corporate booking for ${booking.vehicle_name || 'this vehicle'}? This will also cancel it in RCM.`)) return
    setCancelling(booking.reference)
    setMessage('')
    try {
      const response = await fetch('/api/partner/bookings', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: booking.reference }) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || '取消失败')
      setBookings(current => current.map(item => item.reference === booking.reference ? { ...item, ...data.booking, status: 'cancelled' } : item))
      setMessage(zh ? `订单 ${booking.reference} 已同步取消。` : `Booking ${booking.reference} was cancelled in RCM.`)
    } catch (error: any) {
      setMessage(error?.message || (zh ? '取消失败，订单状态未改变。' : 'Cancellation failed. The booking status was not changed.'))
    } finally { setCancelling('') }
  }

  return <main className="min-h-screen bg-off-white px-5 py-12 text-navy sm:px-8"><div className="mx-auto max-w-[1180px]">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-[11px] font-bold uppercase tracking-[2px] text-orange">Corporate Portal</div><h1 className="mt-2 font-syne text-3xl font-extrabold">{text('欢迎', 'Welcome')}, {account?.displayName || text('企业客户', 'Partner')}</h1><p className="mt-2 text-sm text-muted">{text('企业预订无需在线付款，费用按月结算。', 'Book without online payment and settle by monthly statement.')}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><div className="rounded-xl border border-orange/20 bg-orange/10 px-3 py-2 text-xs font-bold text-orange">{text('专属优惠', 'Partner discount')} {Number(account?.discountPercent || 0)}%</div><button onClick={() => changeLocale('en')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${!zh ? 'bg-navy text-white' : 'bg-white text-muted'}`}>English</button><button onClick={() => changeLocale('zh')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${zh ? 'bg-navy text-white' : 'bg-white text-muted'}`}>中文</button><button onClick={logout} className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-bold">{text('退出登录', 'Log out')}</button></div></header>
    <section className="mt-8 rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-syne text-xl font-extrabold">{text('企业资料', 'Company details')}</h2><p className="mt-1 text-sm text-muted">{text('账号名称会自动作为客户姓名，邮箱和电话只需设置一次。', 'Your account name is used for bookings. Set your email and phone once.')}</p></div>{!loadingProfile && !editingProfile && <button onClick={() => { setMessage(''); setEditingProfile(true) }} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-bold">{text('修改资料', 'Edit details')}</button>}</div>{loadingProfile ? <div className="mt-5 h-16 animate-pulse rounded-xl bg-black/5" /> : editingProfile ? <><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-xs font-bold text-muted">{text('企业邮箱', 'Company email')}<input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-orange" /></label><label className="block text-xs font-bold text-muted">{text('企业电话', 'Company phone')}<input type="tel" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-orange" /></label></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={saveProfile} className="rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white">{text('保存企业资料', 'Save details')}</button>{profile.email && profile.phone && <button onClick={() => setEditingProfile(false)} className="rounded-xl border border-black/10 px-5 py-3 text-sm font-bold">{text('取消', 'Cancel')}</button>}</div></> : <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-off-white px-4 py-3"><div className="text-xs font-bold text-muted">{text('企业邮箱', 'Company email')}</div><div className="mt-1 text-sm font-semibold">{profile.email}</div></div><div className="rounded-xl bg-off-white px-4 py-3"><div className="text-xs font-bold text-muted">{text('企业电话', 'Company phone')}</div><div className="mt-1 text-sm font-semibold">{profile.phone}</div></div></div>}{message && <p className="mt-3 text-sm text-orange">{message}</p>}</section>
    <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><h2 className="font-syne text-xl font-extrabold">{text('预订车辆', 'Book a vehicle')}</h2><p className="mt-2 text-sm leading-relaxed text-muted">{text('使用完整的 YITU 预订流程选择车辆、保险和附加项。企业账号会自动显示专属优惠价格，最后一步不需要在线付款。', 'Choose a vehicle, insurance and extras through the full YITU booking flow. Your partner discount is applied automatically and no online payment is required.')}</p><a href={`/${locale}/booking/vehicles?partner=1`} className="mt-4 inline-flex rounded-xl bg-orange px-5 py-3 text-sm font-bold text-white">{text('进入正式预订流程', 'Start booking')}</a></section>
    <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-syne text-xl font-extrabold">{text('月度 Statement', 'Monthly statement')}</h2><p className="mt-1 text-sm text-muted">{text(`当前账号专属优惠：${Number(account?.discountPercent || 0)}%`, `Current partner discount: ${Number(account?.discountPercent || 0)}%`)}</p></div><label className="text-xs font-bold text-muted">{text('筛选月份', 'Filter month')}<select value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="ml-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-navy outline-none focus:border-orange"><option value="all">{text('全部月份', 'All months')}</option>{statementMonths.map(month => <option key={month} value={month}>{month}</option>)}</select></label></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-black/10 text-xs text-muted"><tr><th className="py-3">{text('月份', 'Month')}</th><th>{text('RCM 参考号', 'RCM reference')}</th><th>{text('车辆', 'Vehicle')}</th><th>{text('取车日期和时间', 'Pickup date & time')}</th><th>{text('还车日期和时间', 'Drop-off date & time')}</th><th>{text('原价', 'Original')}</th><th>{text('优惠', 'Discount')}</th><th>{text('企业价', 'Partner price')}</th><th>{text('状态', 'Status')}</th><th>{text('操作', 'Action')}</th></tr></thead><tbody>{visibleBookings.map(b => <tr key={b.id} className="border-b border-black/5"><td className="py-3">{String(b.pickup_date || b.created_at).slice(0, 7)}</td><td>{b.rcm_reservation_ref || b.reference}</td><td>{b.vehicle_name}</td><td className="whitespace-nowrap">{formatDateTime(b.pickup_date, b.pickup_time)}</td><td className="whitespace-nowrap">{formatDateTime(b.dropoff_date, b.dropoff_time)}</td><td className="text-muted">NZD ${Number(b.original_total || 0).toFixed(2)}</td><td className="font-semibold text-green-700">{Number(b.original_total || 0) > Number(b.partner_total || 0) ? `-${Number(b.original_total - b.partner_total).toFixed(2)}` : `${Number(account?.discountPercent || 0)}%`}</td><td className="font-bold text-orange">NZD ${Number(b.partner_total || 0).toFixed(2)}</td><td>{String(b.status).toLowerCase() === 'cancelled' ? <span className="text-red-600">{text('已取消', 'Cancelled')}</span> : (String(b.status).toLowerCase() === 'confirmed' ? text('已预订', 'Reserved') : b.status)}</td><td>{String(b.status).toLowerCase() === 'cancelled' ? <span className="text-xs text-muted">{text('已完成', 'Done')}</span> : <button onClick={() => cancelBooking(b)} disabled={cancelling === b.reference} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50">{cancelling === b.reference ? text('取消中…', 'Cancelling…') : text('取消预订', 'Cancel booking')}</button>}</td></tr>)}</tbody></table>{visibleBookings.length === 0 && <p className="py-8 text-center text-sm text-muted">{selectedMonth === 'all' ? text('还没有企业预订。', 'No corporate bookings yet.') : text('该月份没有企业预订。', 'No bookings for this month.')}</p>}</div></section>
  </div></main>
}
