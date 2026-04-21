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
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#10214d_0%,#1a2b6b_45%,#e8431a_100%)] transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_32%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
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
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#fff3ec_0%,#ffd7c8_38%,#ffc2ad_100%)] transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(232,67,26,0.26),transparent_28%),radial-gradient(circle_at_80%_75%,rgba(26,43,107,0.18),transparent_26%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/25 to-transparent" />
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
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#14295f_0%,#27408f_48%,#0f172a_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.18),transparent_25%),radial-gradient(circle_at_85%_78%,rgba(232,67,26,0.24),transparent_28%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
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
