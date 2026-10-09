'use client'

import { FormEvent, useState } from 'react'
import { Link } from '@/i18n/navigation'

export default function PartnerLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    const response = await fetch('/api/partner/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, remember }) })
    const data = await response.json()
    if (!response.ok || !data.success) setError(data.error || 'Login failed.')
    else window.location.href = '/en/partner'
    setLoading(false)
  }
  return <main className="min-h-screen bg-[linear-gradient(135deg,#f8f4ef_0%,#eef4fb_100%)] px-5 py-16 text-navy sm:py-24"><div className="mx-auto max-w-[430px]"><Link href="/" className="mb-8 block text-center font-syne text-xl font-extrabold">YITU <span className="text-orange">Car Rental</span></Link><section className="rounded-[28px] border border-black/10 bg-white p-7 shadow-[0_24px_70px_rgba(15,35,71,0.12)] sm:p-9"><div className="mb-7"><div className="text-[11px] font-bold uppercase tracking-[2px] text-orange">Partner Portal</div><h1 className="mt-2 font-syne text-3xl font-extrabold">合作伙伴登录</h1><p className="mt-2 text-sm leading-relaxed text-muted">为旅行社、OTA 和企业合作伙伴提供专属服务入口。</p></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-bold">账号<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none focus:border-orange" placeholder="Partner username" /></label><label className="block text-sm font-bold">密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none focus:border-orange" placeholder="Password" /></label><label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="accent-orange" />记住登录状态</label>{error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<button disabled={loading} className="w-full rounded-xl bg-orange px-4 py-3 font-syne font-bold text-white transition hover:bg-orange-dark disabled:opacity-50">{loading ? '登录中…' : '登录 Partner Portal'}</button></form></section></div></main>
}
