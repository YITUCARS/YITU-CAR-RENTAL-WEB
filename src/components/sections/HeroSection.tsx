'use client'

import Image from 'next/image'
import { ArrowRight, Play, MapPin, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import faviconMark from '@/app/icon.png/android-chrome-512x512.png'

const STATS = [
  { value: '100', suffix: '+', label: 'Vehicles Fleet' },
  { value: '15', suffix: '+', label: 'Years of Service' },
  { value: '3', suffix: '', label: 'NZ Locations' },
]

interface BannerItem {
  id?: string
  slug?: string
  image_url: string
  title: string
  label: string
}

interface DealItem {
  id?: string
  slug?: string
  title: string
  description?: string
  badge?: string
  image_url?: string
  image?: string
}

export default function HeroSection() {
  const [ads, setAds] = useState<BannerItem[]>([])
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  function fetchHeroAds() {
    fetch('/api/public/deals?t=' + Date.now())
        .then(r => r.json())
        .then((dealData: DealItem[]) => {
          const deals = Array.isArray(dealData)
              ? dealData
                  .filter((deal) => Boolean(deal.image_url || deal.image))
                  .map((deal) => ({
                    id: `deal-${deal.id || deal.slug || deal.title}`,
                    slug: deal.slug || String(deal.id ?? ''),
                    image_url: deal.image_url || deal.image || '',
                    title: deal.title,
                    label: deal.description || deal.badge || 'Hot Deal',
                  }))
              : []

          setAds(deals)
          setCurrent(0)
        })
        .catch(() => {
          setAds([])
          setCurrent(0)
        })
  }

  useEffect(() => {
    fetchHeroAds()
  }, [])

  const scrollToBooking = () =>
      document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
  const scrollToFleet = () =>
      document.getElementById('fleet')?.scrollIntoView({ behavior: 'smooth' })

  function next() { setCurrent(c => (c + 1) % ads.length) }
  function prev() { setCurrent(c => (c - 1 + ads.length) % ads.length) }
  function goTo(i: number) { setCurrent(i) }

  useEffect(() => {
    if (paused || ads.length <= 1) return
    timerRef.current = setTimeout(next, 5000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [current, paused, ads.length])

  const ad = ads[current] ?? null

  return (
      <section
          id="home"
          className="relative min-h-screen pt-[120px] pb-[60px] px-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center overflow-hidden"
      >
        <div
            className="absolute left-[2%] bottom-[5%] h-[260px] w-[40%] opacity-[0.28] pointer-events-none z-0"
            style={{
              backgroundImage:
                  'linear-gradient(rgba(26,43,107,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(26,43,107,0.08) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              maskImage: 'linear-gradient(180deg, transparent 0%, black 22%, black 78%, transparent 100%)',
            }}
        />

        {/* 蓝色斜纹背景 */}
        <div
            className="absolute right-0 top-0 bottom-0 w-[62%] opacity-[0.18] pointer-events-none z-0"
            style={{
              background: 'linear-gradient(135deg,#1a2b6b 0%,#243580 100%)',
              clipPath: 'polygon(30% 0,100% 0,100% 100%,0 100%)',
            }}
        />

        {/* 径向渐变 */}
        <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              background:
                  'radial-gradient(ellipse 70% 60% at 75% 50%,rgba(26,43,107,.35) 0%,transparent 70%), radial-gradient(ellipse 50% 40% at 20% 80%,rgba(232,67,26,.08) 0%,transparent 60%)',
            }}
        />

        {/* 轮播图 — 与蓝色背景完全重叠 */}
        <div
            className={`hidden lg:block absolute right-0 top-0 bottom-0 w-[62%] z-[1] ${ad?.slug ? 'cursor-pointer' : ''}`}
            style={{ clipPath: 'polygon(30% 0,100% 0,100% 100%,0 100%)' }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onClick={() => ad?.slug && router.push(`/deals/${ad.slug}`)}
        >
          {ads.length > 0 ? (
            <div className="absolute inset-0">
              {ads.map((item, index) => (
                <img
                    key={item.id ?? `${item.image_url}-${index}`}
                    src={item.image_url}
                    alt={item.title}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                        index === current ? 'opacity-100' : 'opacity-0'
                    }`}
                />
              ))}
            </div>
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,#1a2b6b_0%,#243580_55%,#0f172a_100%)]" />
          )}

          {/* 渐变遮罩 — 左下角和底部加深 */}
          <div
              className="absolute inset-0"
              style={{
                background:
                    'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 35%, transparent 60%), linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 50%)',
              }}
          />

          {/* 文字 + 按钮 — 固定在底部 30%，不随图片内容移动 */}
          <div className="absolute bottom-[22%] left-0 right-0 flex flex-col items-center text-center px-[15%]">
            <div className="text-white/60 text-[14px] uppercase tracking-[3px] font-medium mb-3">
              {ad?.label || 'YITU Car Rental'}
            </div>
            <div
                className="text-white font-syne font-extrabold leading-tight mb-8 whitespace-pre-line drop-shadow-lg"
                style={{ fontSize: 'clamp(2rem, 3.5vw, 3.2rem)' }}
            >
              {ad?.title || 'Explore New Zealand\nThe Better Way'}
            </div>
            <button
                onClick={e => { e.stopPropagation(); ad?.slug ? router.push(`/deals/${ad.slug}`) : scrollToBooking() }}
                className="flex items-center gap-3 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[16px] px-10 py-4 rounded-full transition-colors shadow-lg"
            >
              Learn More <ArrowRight size={18} />
            </button>
          </div>

          {/* 控制栏 — 左下角，紧贴底部 */}
          <div className="absolute bottom-[13%] left-[22%] right-6 flex items-center justify-between" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <button
                  onClick={prev}
                  disabled={ads.length <= 1}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-all"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                  onClick={next}
                  disabled={ads.length <= 1}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-all"
              >
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {ads.map((_, i) => (
                  <button
                      key={i}
                      onClick={() => goTo(i)}
                      className={`rounded-full transition-all ${
                          i === current ? 'w-5 h-2 bg-orange' : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                      }`}
                  />
              ))}
            </div>
            <div className="text-[11px] text-white/70 font-medium">
              {ads.length > 0 ? `${current + 1} / ${ads.length}` : '0 / 0'}
            </div>
          </div>
        </div>

        {/* 左侧内容 */}
        <div className="relative z-10 ml-[10%] max-w-[500px]">
          <div className="inline-flex items-center gap-2 bg-orange/12 border border-orange/30 text-orange text-[12px] font-medium px-3.5 py-1.5 rounded-full mb-2">
            <MapPin size={12} />
            Start your journey with us
          </div>

          <h1
              className="font-montserrat font-extrabold italic text-navy leading-[1.04] mb-5 text-[clamp(2.5rem,4vw,4.1rem)] -ml-2"
          >
            <span className="block whitespace-nowrap">Explore New Zealand</span>
            <span className="block pl-[8%] whitespace-nowrap text-orange">The Better Choice</span>
          </h1>

          <div className="flex gap-3.5 flex-wrap">
            <button
                onClick={() => router.push('/booking/vehicles')}
                className="flex items-center gap-2 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[15px] px-[30px] py-3.5 rounded-full shadow-orange-glow transition-all hover:-translate-y-0.5"
            >
              Book Now <ArrowRight size={16} />
            </button>
            <button
                onClick={scrollToFleet}
                className="flex items-center gap-2 bg-navy/[0.06] border-[1.5px] border-black/[0.18] text-navy font-syne font-bold text-[15px] px-7 py-3.5 rounded-full transition-all hover:bg-navy/10 hover:border-navy/25"
            >
              <Play size={14} />
              View Fleet
            </button>
          </div>

          <div className="mt-7 flex items-center gap-4 border-l-[3px] border-orange pl-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 border border-navy/8 shadow-[0_10px_24px_rgba(15,23,42,0.06)] overflow-hidden">
              <Image
                src={faviconMark}
                alt="YITU icon"
                width={40}
                height={40}
                className="h-7 w-7 object-contain"
              />
            </div>
            <div className="max-w-[360px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">Trusted Road Trips</div>
              <div className="mt-1 text-[13px] leading-[1.6] text-navy/80">
                Unlimited kilometres, responsive support, and smooth pick-up across our New Zealand locations.
              </div>
            </div>
          </div>

          <div className="flex gap-9 mt-12 pt-8 border-t border-black/10 flex-wrap">
            {STATS.map((s) => (
                <div key={s.label}>
                  <strong className="font-syne font-extrabold text-[2.2rem] text-navy leading-none block">
                    {s.value}<em className="text-orange not-italic">{s.suffix}</em>
                  </strong>
                  <span className="text-[11px] text-muted uppercase tracking-[0.8px]">{s.label}</span>
                </div>
            ))}
          </div>
        </div>

      </section>
  )
}
