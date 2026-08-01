'use client'

import { useEffect, useState } from 'react'
import { Cookie, ShieldCheck, X } from 'lucide-react'

const STORAGE_KEY = 'yitu-cookie-consent'

type CookieChoice = 'all' | 'essential'

const COPY = {
  en: {
    eyebrow: 'Privacy notice',
    title: 'We use cookies to keep your rental journey smooth.',
    body:
      'YITU uses essential cookies for security, booking flow and customer identification. With your consent, we may also use cookies or similar technologies to understand page visits, personalise features and improve our website.',
    acceptAll: 'Accept all',
    essentialOnly: 'Essential only',
    privacy: 'Privacy Notice',
    saved: 'Cookie preference saved',
  },
  zh: {
    eyebrow: '隐私提示',
    title: '我们使用 Cookie 来保障租车流程顺畅。',
    body:
      'YITU 会使用必要 Cookie 保障网站安全、预订流程和客户识别。在您同意的情况下，我们也可能使用 Cookie 或类似技术了解页面访问、提供个性化功能并改进网站体验。',
    acceptAll: '接受全部',
    essentialOnly: '仅必要',
    privacy: '隐私声明',
    saved: 'Cookie 偏好已保存',
  },
}

function getLocaleFromPath() {
  if (typeof window === 'undefined') return 'en'
  return window.location.pathname.startsWith('/zh') ? 'zh' : 'en'
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)
  const [locale, setLocale] = useState<'en' | 'zh'>('en')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLocale(getLocaleFromPath())
    setVisible(window.localStorage.getItem(STORAGE_KEY) == null)
  }, [])

  function saveChoice(choice: CookieChoice) {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        choice,
        savedAt: new Date().toISOString(),
        version: 1,
      }),
    )
    setSaved(true)
    window.setTimeout(() => setVisible(false), 420)
  }

  if (!visible) return null

  const copy = COPY[locale]
  const privacyHref = locale === 'zh' ? '/zh/privacy-policy#online-data' : '/privacy-policy#online-data'

  return (
    <div className="fixed inset-x-0 bottom-0 z-[75] px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="mx-auto max-w-[980px] overflow-hidden rounded-[26px] border border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop-blur-xl">
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange/10 text-orange">
            <Cookie size={23} />
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.2em] text-orange">
              <ShieldCheck size={13} />
              {copy.eyebrow}
            </div>
            <h2 className="font-syne text-[1.05rem] font-extrabold leading-tight text-navy sm:text-[1.25rem]">
              {copy.title}
            </h2>
            <p className="mt-2 max-w-[720px] text-[12.5px] leading-5 text-muted sm:text-[13.5px] sm:leading-6">
              {copy.body}{' '}
              <a href={privacyHref} className="font-bold text-orange transition-colors hover:text-orange-dark hover:underline">
                {copy.privacy}
              </a>
            </p>
            {saved && (
              <p className="mt-2 text-[12px] font-semibold text-emerald-700">
                {copy.saved}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <button
              onClick={() => saveChoice('all')}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange px-5 font-syne text-[13px] font-bold text-white shadow-orange-glow transition-colors hover:bg-orange-dark"
            >
              {copy.acceptAll}
            </button>
            <button
              onClick={() => saveChoice('essential')}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-black/10 bg-white px-5 font-syne text-[13px] font-bold text-navy transition-colors hover:border-orange/35 hover:text-orange"
            >
              {copy.essentialOnly}
            </button>
          </div>
        </div>

        <button
          aria-label="Close cookie notice"
          onClick={() => saveChoice('essential')}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-navy/5 text-muted transition-colors hover:bg-navy/10 hover:text-navy"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
