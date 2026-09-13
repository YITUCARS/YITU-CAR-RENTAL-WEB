'use client'

import { ArrowRight, BadgeCheck, Gem, Heart, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'

export default function WeddingEntrySection() {
    const t = useTranslations('Wedding')
    const router = useRouter()

    const features = [
        { icon: Gem, label: t('featureOne') },
        { icon: Heart, label: t('featureTwo') },
        { icon: BadgeCheck, label: t('featureThree') },
        { icon: MapPin, label: t('featureFour') },
    ]

    return (
        <section className="px-6 py-10 sm:px-10 sm:py-14">
            <div className="mx-auto max-w-[1180px]">
                <div className="relative isolate overflow-hidden rounded-[28px] bg-[#f7f1e8] shadow-[0_18px_50px_rgba(15,35,71,0.10)]">
                    {/* Photograph fills the card and dissolves into the cream on the left. */}
                    <div
                        className="absolute inset-0 -z-20 bg-[url('/wedding/wedding-entry.webp')] bg-cover bg-[center_40%] bg-no-repeat sm:bg-[right_40%]"
                        aria-hidden="true"
                    />
                    <div
                        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(247,241,232,0.95)_0%,rgba(247,241,232,0.86)_55%,rgba(247,241,232,0.94)_100%)] sm:bg-[linear-gradient(90deg,#f7f1e8_0%,#f7f1e8_26%,rgba(247,241,232,0.9)_42%,rgba(247,241,232,0.5)_56%,rgba(247,241,232,0.08)_70%,rgba(247,241,232,0)_82%)]"
                        aria-hidden="true"
                    />

                    <div className="relative flex min-h-[340px] flex-col justify-center px-7 py-10 sm:px-11 sm:py-12 lg:min-h-[380px]">
                        <div className="max-w-[430px]">
                            <div className="mb-4 flex items-center gap-2.5">
                                <span className="h-px w-7 bg-[#a4854d]" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a4854d]">{t('kicker')}</span>
                            </div>

                            <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.25rem)] font-bold leading-[1.12] text-navy">{t('title')}</h2>

                            <p className="mt-4 max-w-[380px] text-[13px] leading-[1.8] text-navy/65">{t('subtitle')}</p>

                            <button
                                type="button"
                                onClick={() => router.push('/wedding-car-rental')}
                                className="group mt-7 inline-flex items-center gap-2.5 rounded-full bg-[#a4854d] px-6 py-3.5 font-syne text-[12.5px] font-bold text-white shadow-[0_10px_26px_rgba(164,133,77,0.3)] transition-all hover:bg-[#8d7040]"
                            >
                                {t('cta')}
                                <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
                            </button>
                        </div>

                        <div className="mt-9 grid max-w-[600px] grid-cols-2 gap-y-5 sm:grid-cols-4">
                            {features.map((feature, index) => {
                                const Icon = feature.icon
                                return (
                                    <div
                                        key={feature.label}
                                        className={`flex flex-col items-start gap-2 px-4 first:pl-0 ${index > 0 ? 'border-l border-navy/12' : ''}`}
                                    >
                                        <Icon size={16} strokeWidth={1.4} className="text-[#a4854d]" />
                                        <span className="text-[10.5px] font-medium leading-snug text-navy/70">{feature.label}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
