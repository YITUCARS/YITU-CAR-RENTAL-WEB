'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Tag } from 'lucide-react'
import { DEALS } from '@/lib/data'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ManageBookingModal from '@/components/ui/ManageBookingModal'

interface Deal {
    id?: string
    slug: string
    title: string
    description: string
    value: string
    unit?: string
    badge: string
    image_url?: string
    image?: string
    content?: string
}

// Hardcoded content fallback for the two existing deals
const FALLBACK_CONTENT: Record<string, string> = {
    easter: `Enjoy $6.6 per day fuel subsidy on every rental during our Easter promotion. Whether you're heading to the mountains or the coast, this deal helps you explore more for less.\n\nValid on all vehicle categories. The fuel subsidy is automatically applied to your rental — no promo code required.\n\nOffer available for rentals with pickup between 1 April and 30 April. Minimum 3-day rental applies.`,
    autumn: `Save 10% across our entire fleet this autumn. From compact sedans to spacious MPVs, every vehicle category is included.\n\nThe discount is applied automatically at checkout. Combine with our unlimited kilometre policy for total peace of mind on longer road trips.\n\nOffer valid for pickups between 1 March and 31 May. Cannot be combined with other promotions.`,
}

export default function DealPage({ params }: { params: { slug: string } }) {
    const router = useRouter()
    const [deal, setDeal] = useState<Deal | null>(null)
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)

    useEffect(() => {
        fetch('/api/public/deals')
            .then(r => r.json())
            .then((data: Deal[]) => {
                // Match by slug first, then fall back to id (in case slug was empty)
                const found = Array.isArray(data)
                    ? data.find(d => (d.slug && d.slug === params.slug) || d.id === params.slug)
                    : null
                if (found) {
                    setDeal(found)
                } else {
                    // Fall back to hardcoded DEALS by id
                    const hc = DEALS.find(d => d.id === params.slug)
                    if (hc) {
                        setDeal({
                            slug: hc.id,
                            title: hc.title,
                            description: hc.description,
                            value: hc.value,
                            unit: hc.unit,
                            badge: hc.badge,
                            image_url: hc.image,
                            content: FALLBACK_CONTENT[hc.id] ?? '',
                        })
                    }
                }
            })
            .catch(() => {
                const hc = DEALS.find(d => d.id === params.slug)
                if (hc) {
                    setDeal({
                        slug: hc.id,
                        title: hc.title,
                        description: hc.description,
                        value: hc.value,
                        unit: hc.unit,
                        badge: hc.badge,
                        image_url: hc.image,
                        content: FALLBACK_CONTENT[hc.id] ?? '',
                    })
                }
            })
            .finally(() => setLoading(false))
    }, [params.slug])

    if (loading) {
        return (
            <>
                <Navbar onManageBooking={() => setModalOpen(true)} />
                <ManageBookingModal open={modalOpen} onClose={() => setModalOpen(false)} />
                <div className="min-h-screen flex items-center justify-center pt-[120px]">
                    <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
                </div>
                <Footer onManageBooking={() => setModalOpen(true)} />
            </>
        )
    }

    if (!deal) {
        return (
            <>
                <Navbar onManageBooking={() => setModalOpen(true)} />
                <ManageBookingModal open={modalOpen} onClose={() => setModalOpen(false)} />
                <div className="min-h-screen flex flex-col items-center justify-center gap-4 pt-[120px]">
                    <div className="text-navy font-syne font-bold text-2xl">Deal not found</div>
                    <button onClick={() => router.push('/#deals')} className="text-orange hover:underline text-sm">
                        ← Back to Hot Deals
                    </button>
                </div>
                <Footer onManageBooking={() => setModalOpen(true)} />
            </>
        )
    }

    const imageUrl = deal.image_url || deal.image || ''
    const paragraphs = (deal.content ?? '').split('\n').filter(Boolean)

    return (
        <>
        <Navbar onManageBooking={() => setModalOpen(true)} />
        <ManageBookingModal open={modalOpen} onClose={() => setModalOpen(false)} />
        <main className="min-h-screen bg-white pt-[120px]">
            {/* Hero */}
            <div className="relative h-[60vh] min-h-[420px] overflow-hidden">
                {imageUrl ? (
                    <img src={imageUrl} alt={deal.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-navy" />
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />

                {/* Back button */}
                <button
                    onClick={() => router.back()}
                    className="absolute top-6 left-6 flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/25 text-white text-sm font-medium px-4 py-2 rounded-full transition-all"
                >
                    <ArrowLeft size={14} /> Back
                </button>

                {/* Deal info */}
                <div className="absolute bottom-0 left-0 right-0 px-8 pb-12 max-w-[900px] mx-auto">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center gap-1.5 bg-orange text-white text-[11px] font-bold px-3 py-1 rounded-full font-syne">
                            <Tag size={10} /> {deal.badge}
                        </span>
                    </div>
                    <div className="font-syne font-extrabold text-orange text-[4rem] leading-none mb-2">
                        {deal.value}
                        {deal.unit && <span className="text-[1.8rem]">{deal.unit}</span>}
                    </div>
                    <h1 className="font-syne font-extrabold text-white text-[clamp(1.6rem,3vw,2.8rem)] leading-tight mb-2">
                        {deal.title}
                    </h1>
                    <p className="text-white/70 text-[15px] max-w-[540px]">{deal.description}</p>
                </div>
            </div>

            {/* Article body */}
            <div className="max-w-[760px] mx-auto px-8 py-16">
                {paragraphs.length > 0 ? (
                    <div className="space-y-5">
                        {paragraphs.map((p, i) => (
                            <p key={i} className="text-[15.5px] text-navy/80 leading-[1.85]">{p}</p>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted text-[14px]">Check back for full terms and conditions.</p>
                )}

                <div className="mt-6 pt-6 border-t border-black/10">
                    <p className="text-[12px] text-muted">Terms and conditions apply. Offer subject to availability.</p>
                </div>

                {/* CTA */}
                <div className="mt-12 flex flex-wrap gap-3">
                    <button
                        onClick={() => router.push('/#booking')}
                        className="flex items-center gap-2 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[15px] px-8 py-3.5 rounded-full shadow-orange-glow transition-all hover:-translate-y-0.5"
                    >
                        Book Now <ArrowRight size={16} />
                    </button>
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 bg-transparent border-[1.5px] border-black/15 text-navy font-syne font-bold text-[15px] px-7 py-3.5 rounded-full transition-all hover:border-navy/30"
                    >
                        <ArrowLeft size={15} /> All Deals
                    </button>
                </div>
            </div>
        </main>
        <Footer onManageBooking={() => setModalOpen(true)} />
        </>
    )
}
