'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Tag, ArrowRight } from 'lucide-react'
import { DEALS } from '@/lib/data'

interface DealItem {
    id?: string
    slug: string
    title: string
    description: string
    value: string
    unit?: string
    badge: string
    image_url?: string
    image?: string
}

const FALLBACK: DealItem[] = DEALS.map(d => ({ ...d, slug: d.id, image_url: d.image }))

export default function DealsSection() {
    const router = useRouter()
    const [deals, setDeals] = useState<DealItem[]>(FALLBACK)

    useEffect(() => {
        fetch('/api/public/deals')
            .then(r => r.json())
            .then((data: DealItem[]) => {
                if (Array.isArray(data) && data.length > 0) setDeals(data)
            })
            .catch(() => {})
    }, [])

    return (
        <section id="deals" className="py-20 px-10 bg-off-white border-t border-black/10">
            <div className="max-w-[1100px] mx-auto">
                {/* Header */}
                <div className="mb-9">
                    <div className="flex items-center gap-2 text-[11.5px] text-orange uppercase tracking-[2.5px] font-bold mb-2.5 before:content-[''] before:w-5 before:h-0.5 before:bg-orange">
                        Limited Time
                    </div>
                    <h2 className="font-montserrat font-extrabold italic text-[clamp(1.8rem,3vw,2.8rem)] text-navy leading-[1.1]">
                        Hot <span className="text-orange">Deals</span>
                    </h2>
                </div>

                {/* Deals grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {deals.map((deal) => {
                        const img = deal.image_url || deal.image || ''
                        return (
                            <div
                                key={deal.slug || deal.id}
                                className="relative rounded-card overflow-hidden min-h-[220px] flex flex-col justify-end p-6 cursor-pointer group"
                                onClick={() => router.push(`/deals/${deal.slug || deal.id}`)}
                            >
                                {/* Background image */}
                                {img && (
                                    <img
                                        src={img}
                                        alt={deal.title}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                )}
                                {!img && <div className="absolute inset-0 bg-navy" />}

                                {/* Gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                                {/* Badge */}
                                <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-orange text-white text-[11px] font-bold px-3 py-1 rounded-full font-syne">
                                    <Tag size={10} />
                                    {deal.badge}
                                </div>

                                {/* Body */}
                                <div className="relative z-10">
                                    <p className="text-[14px] text-white/75 leading-[1.5] mb-2.5 max-w-[300px]">
                                        {deal.title} — {deal.description}
                                    </p>
                                    <div className="font-syne font-extrabold text-orange text-[3rem] leading-none mb-2">
                                        {deal.value}
                                        {deal.unit && <span className="text-[1.2rem]">{deal.unit}</span>}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[12px] text-white/60 group-hover:text-white/90 transition-colors">
                                        View Deal <ArrowRight size={12} />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
