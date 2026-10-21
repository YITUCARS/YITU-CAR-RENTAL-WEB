'use client'

import {useState, useEffect} from 'react'
import {useLocale, useTranslations} from 'next-intl'
import {useRouter} from '@/i18n/navigation'
import {DEALS} from '@/lib/data'
import {localizeDeal} from '@/lib/deal-locale'
import DealCard, {type DealCardData} from './DealCard'

interface DealItem extends DealCardData {
    slug: string
}

const FALLBACK: DealItem[] = DEALS.map(d => ({...d, slug: d.id, image_url: d.image}))

export default function DealsSection({initialDeals}: {initialDeals?: DealItem[]}) {
    const t = useTranslations()
    const locale = useLocale()
    const router = useRouter()
    const [deals, setDeals] = useState<DealItem[]>(
        initialDeals && initialDeals.length > 0 ? initialDeals : []
    )

    useEffect(() => {
        if (initialDeals && initialDeals.length > 0) return
        fetch('/api/public/deals')
            .then(r => r.json())
            .then((data: DealItem[]) => { if (data.length > 0) setDeals(data) })
            .catch(() => setDeals(FALLBACK))
    }, [])

    const displayDeals = (deals.length > 0 ? deals : FALLBACK).map(d => localizeDeal(d, locale))

    return (
        <section id="deals" className="py-20 px-4 sm:px-10 bg-off-white border-t border-black/10">
            <div className="max-w-[1100px] mx-auto">
                <div className="mb-9">
                    <div className="flex items-center gap-2 text-[11.5px] text-orange uppercase tracking-[2.5px] font-bold mb-2.5 before:content-[''] before:w-5 before:h-0.5 before:bg-orange">
                        {t('DealsSection.kicker')}
                    </div>
                    <h2 className="font-montserrat font-extrabold italic text-[clamp(1.8rem,3vw,2.8rem)] text-navy leading-[1.1]">
                        {t('DealsSection.titlePrefix')} <span className="text-orange">{t('DealsSection.titleAccent')}</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayDeals.map(deal => (
                        <DealCard
                            key={deal.slug || deal.id}
                            deal={deal}
                            viewLabel={t('DealsSection.viewDeal')}
                            onClick={() => router.push(`/deals/${deal.slug || deal.id}`)}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}
