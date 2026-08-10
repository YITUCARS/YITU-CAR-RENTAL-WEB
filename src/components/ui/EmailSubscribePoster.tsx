'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Mail, Sparkles, X } from 'lucide-react'

const STORAGE_KEY = 'yitu-email-poster-dismissed'

export default function EmailSubscribePoster() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.sessionStorage.getItem(STORAGE_KEY) === 'true') return

    function openAfterChatClose() {
      if (window.sessionStorage.getItem(STORAGE_KEY) === 'true') return
      window.setTimeout(() => setOpen(true), 450)
    }

    window.addEventListener('yitu:chat-closed', openAfterChatClose)
    return () => window.removeEventListener('yitu:chat-closed', openAfterChatClose)
  }, [])

  function closePoster() {
    window.sessionStorage.setItem(STORAGE_KEY, 'true')
    setOpen(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          pageUrl: window.location.href,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || 'Unable to submit right now.')
      }
      setSubmitted(true)
      window.sessionStorage.setItem(STORAGE_KEY, 'true')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit right now.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-3 py-4 sm:px-4 sm:py-8">
      <button
        aria-label="Close subscription poster"
        className="absolute inset-0 bg-navy/45 backdrop-blur-[3px]"
        onClick={closePoster}
      />

      <div className="relative max-h-[calc(100vh-32px)] w-full max-w-[420px] overflow-hidden rounded-[24px] bg-[#fff8ef] shadow-[0_30px_90px_rgba(15,23,42,0.32)] sm:max-w-[760px] sm:rounded-[32px]">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange/25 blur-2xl" />
        <div className="absolute -bottom-20 left-10 h-52 w-52 rounded-full bg-[#f7c873]/35 blur-3xl" />

        <button
          aria-label="Close"
          onClick={closePoster}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-navy shadow-sm transition-colors hover:bg-white sm:right-5 sm:top-5 sm:h-10 sm:w-10"
        >
          <X size={18} />
        </button>

        <div className="grid gap-0 md:grid-cols-[0.92fr_1.08fr]">
          <div className="relative min-h-[150px] bg-navy p-5 text-white sm:min-h-[220px] sm:p-8 md:min-h-[420px]">
            <div className="absolute inset-0 opacity-35" style={{
              backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(232,67,26,0.9), transparent 28%), radial-gradient(circle at 80% 75%, rgba(255,255,255,0.22), transparent 24%)',
            }} />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/85 sm:mb-5 sm:text-[11px]">
                  <Sparkles size={13} className="text-orange" />
                  YITU Insider
                </div>
                <h2 className="max-w-[300px] font-syne text-[clamp(1.75rem,9vw,2.8rem)] font-extrabold leading-[0.95] md:text-[clamp(2.3rem,5vw,4rem)]">
                  NZ road trip deals, first.
                </h2>
              </div>
              <p className="mt-4 max-w-[300px] text-[12px] leading-5 text-white/72 sm:mt-8 sm:max-w-[260px] sm:text-[14px] sm:leading-6">
                Be the first to hear about limited car rental offers, seasonal routes, and local travel tips.
              </p>
            </div>
          </div>

          <div className="relative p-5 sm:p-10">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange text-white shadow-orange-glow sm:mb-6 sm:h-14 sm:w-14">
              <Mail size={22} />
            </div>
            <h3 className="font-syne text-[1.45rem] font-extrabold leading-tight text-navy sm:text-[2rem]">
              Subscribe for future offers
            </h3>
            <p className="mt-2 text-[12.5px] leading-5 text-muted sm:mt-3 sm:text-[14px] sm:leading-6">
              Leave your email and our team will receive a Telegram reminder. We will connect the real mailing list later.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3 sm:mt-7">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your@email.com"
                className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-[15px] font-medium text-navy outline-none transition-colors placeholder:text-muted/55 focus:border-orange sm:h-[52px]"
                required
              />
              <button
                type="submit"
                disabled={submitting || submitted}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-orange px-5 font-syne text-[15px] font-bold text-white transition-transform hover:scale-[1.015] hover:bg-orange-dark sm:h-[52px]"
              >
                {submitting ? 'Sending...' : submitted ? 'Interest sent to our team' : 'Notify me later'}
              </button>
            </form>

            {error && (
              <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
                {error}
              </p>
            )}

            {submitted && (
              <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700">
                Thanks. We have sent this subscription interest to the YITU team.
              </p>
            )}

            <button
              onClick={closePoster}
              className="mt-5 text-[12px] font-bold uppercase tracking-[0.18em] text-muted transition-colors hover:text-navy"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
