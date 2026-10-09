'use client'
import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'

export default function PartnerPortalPage() {
  const [account, setAccount] = useState<{ displayName?: string; username?: string } | null>(null)
  useEffect(() => { fetch('/api/partner/session').then(r => r.json()).then(data => { if (data.success) setAccount(data.account); else window.location.href = '/en/partner/login' }).catch(() => { window.location.href = '/en/partner/login' }) }, [])
  async function logout() { await fetch('/api/partner/login', { method: 'DELETE' }); window.location.href = '/en/partner/login' }
  return <main className="min-h-screen bg-off-white px-5 py-14 text-navy sm:px-8"><div className="mx-auto max-w-[980px]"><div className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-[11px] font-bold uppercase tracking-[2px] text-orange">Partner Portal</div><h1 className="mt-2 font-syne text-3xl font-extrabold">欢迎，{account?.displayName || '合作伙伴'}</h1><p className="mt-2 text-sm text-muted">合作伙伴专属服务入口</p></div><button onClick={logout} className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-bold">退出登录</button></div><div className="mt-8 grid gap-4 sm:grid-cols-2"><Link href="/booking/vehicles" className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-orange/40"><div className="font-syne text-lg font-extrabold">开始预订车辆</div><p className="mt-2 text-sm leading-relaxed text-muted">进入 YITU 车辆搜索和预订流程。</p><div className="mt-5 text-sm font-bold text-orange">开始搜索 →</div></Link><div className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-6"><div className="font-syne text-lg font-extrabold">更多合作功能</div><p className="mt-2 text-sm leading-relaxed text-muted">专属价格、订单管理和门票服务正在逐步开放。</p></div></div></div></main>
}
