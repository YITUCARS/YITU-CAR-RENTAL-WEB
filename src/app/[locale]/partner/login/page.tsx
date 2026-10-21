'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'

export default function PartnerLoginPage() {
  const routeLocale = useLocale() as 'en' | 'zh'
  const [locale, setLocale] = useState<'en' | 'zh'>(routeLocale)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const zh = locale === 'zh'
  useEffect(() => {
    const saved = window.localStorage.getItem('yitu-partner-locale') as 'en' | 'zh' | null
    const browserLocale: 'en' | 'zh' = saved || (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en')
    setLocale(browserLocale)
    if (browserLocale !== routeLocale) window.location.replace(`/${browserLocale}/partner/login`)
  }, [routeLocale])
  function changeLocale(next: 'en' | 'zh') {
    window.localStorage.setItem('yitu-partner-locale', next)
    window.location.href = `/${next}/partner/login`
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    const response = await fetch('/api/partner/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, remember }) })
    const data = await response.json()
    if (!response.ok || !data.success) setError(data.error || 'Login failed.')
    else {
      window.localStorage.setItem('yitu-partner-locale', locale)
      window.location.href = `/${locale}/partner`
    }
    setLoading(false)
  }
  return <main className="min-h-screen bg-[linear-gradient(135deg,#f8f4ef_0%,#eef4fb_100%)] px-5 py-16 text-navy sm:py-24"><div className="mx-auto max-w-[430px]"><div className="mb-5 flex justify-end gap-1"><button onClick={() => changeLocale('en')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${!zh ? 'bg-navy text-white' : 'bg-white/70 text-muted'}`}>English</button><button onClick={() => changeLocale('zh')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${zh ? 'bg-navy text-white' : 'bg-white/70 text-muted'}`}>中文</button></div><Link href="/" className="mb-8 block text-center font-syne text-xl font-extrabold">YITU <span className="text-orange">Car Rental</span></Link><section className="rounded-[28px] border border-black/10 bg-white p-7 shadow-[0_24px_70px_rgba(15,35,71,0.12)] sm:p-9"><div className="mb-7"><div className="text-[11px] font-bold uppercase tracking-[2px] text-orange">Partner Portal</div><h1 className="mt-2 font-syne text-3xl font-extrabold">{zh ? '合作伙伴登录' : 'Partner login'}</h1><p className="mt-2 text-sm leading-relaxed text-muted">{zh ? '为旅行社、OTA 和企业合作伙伴提供专属服务入口。' : 'A dedicated portal for travel agents, OTAs and business partners.'}</p></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-bold">{zh ? '账号' : 'Username'}<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none focus:border-orange" placeholder="Partner username" /></label><label className="block text-sm font-bold">{zh ? '密码' : 'Password'}<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none focus:border-orange" placeholder="Password" /></label><label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="accent-orange" />{zh ? '记住登录状态' : 'Remember me'}</label>{error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<button disabled={loading} className="w-full rounded-xl bg-orange px-4 py-3 font-syne font-bold text-white transition hover:bg-orange-dark disabled:opacity-50">{loading ? (zh ? '登录中…' : 'Signing in…') : (zh ? '登录 Partner Portal' : 'Sign in to Partner Portal')}</button></form></section></div></main>
}
