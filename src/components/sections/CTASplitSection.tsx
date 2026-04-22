'use client'

import {ArrowRight} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useRouter} from '@/i18n/navigation'

export default function CTASplitSection() {
  const t = useTranslations()
  const router = useRouter()
  const goToBooking = () => router.push('/booking/vehicles')

  return (
    <section className="px-4 sm:px-10 pb-20">
      <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="relative rounded-card overflow-hidden min-h-[200px] md:min-h-[280px] flex flex-col justify-end p-8 cursor-pointer group"
          onClick={goToBooking}
        >
          <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={{backgroundImage: "url('/roadtrip-bg.png')"}} />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,33,77,0.60)_0%,rgba(26,43,107,0.45)_45%,rgba(232,67,26,0.50)_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
          <div className="relative z-10">
            <h3 className="font-syne font-extrabold text-sm md:text-[1.4rem] text-white leading-[1.2] mb-2.5">
              {t('CTA.primaryTitleLine1')}<br />{t('CTA.primaryTitleLine2')}
            </h3>
            <p className="text-[13px] text-white/60 leading-[1.6] mb-4">
              {t('CTA.primaryCopy')}
            </p>
            <button className="inline-flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-[22px] py-2.5 rounded-lg transition-colors">
              {t('CTA.getStarted')} <ArrowRight size={13} />
            </button>
          </div>
        </div>

        <div className="grid grid-rows-[1fr_auto] gap-4">
          <div
            className="relative rounded-card overflow-hidden flex flex-col justify-end p-6 cursor-pointer group"
            onClick={goToBooking}
          >
            <div className="absolute inset-0 bg-cover bg-bottom transition-transform duration-500 group-hover:scale-105" style={{backgroundImage: "url('/oneway-bg.png')"}} />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/30 to-transparent" />
            <div className="relative z-10">
              <h3 className="font-syne font-extrabold text-sm md:text-[1.4rem] text-white leading-[1.2] mb-2.5">
                {t('CTA.secondaryTitle')}
              </h3>
              <p className="text-[13px] text-white/60 leading-[1.6] mb-4">
                {t('CTA.secondaryCopy')}
              </p>
              <button className="inline-flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-[22px] py-2.5 rounded-lg transition-colors">
                {t('Navbar.bookNow')} <ArrowRight size={13} />
              </button>
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded-card p-6 cursor-pointer group"
            onClick={goToBooking}
          >
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={{backgroundImage: "url('/vehicles-bg.jpg')"}} />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(20,41,95,0.72)_0%,rgba(39,64,143,0.55)_48%,rgba(15,23,42,0.70)_100%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="relative z-10 flex items-end justify-between gap-4">
              <div>
                <h3 className="font-syne font-extrabold text-sm md:text-[1.4rem] text-white leading-[1.2] mb-2.5">
                  {t('CTA.statsTitle')}
                </h3>
                <p className="text-[13px] text-white/60 leading-[1.6] max-w-[260px]">
                  {t('CTA.statsCopy')}
                </p>
              </div>
              <strong className="font-syne font-extrabold text-xl md:text-[2.1rem] text-orange leading-none">100+</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
