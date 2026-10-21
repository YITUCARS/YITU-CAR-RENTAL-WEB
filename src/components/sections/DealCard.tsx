import Image from 'next/image'
import {Tag, ArrowRight} from 'lucide-react'
import {dealOverlay, dealTextScale} from '@/lib/deal-locale'

export interface DealCardData {
    id?: string
    slug?: string
    title: string
    description: string
    value: string
    unit?: string
    badge: string
    image_url?: string
    image?: string
    overlay?: number | null
    text_scale?: number | null
}

// Home-page Hot Deals card; also used as the live preview in the admin editor.
// `plainImage` skips next/image so any pasted URL can be previewed in the admin.
export default function DealCard({deal, viewLabel, onClick, plainImage}: {deal: DealCardData; viewLabel: string; onClick?: () => void; plainImage?: boolean}) {
    const img = deal.image_url || deal.image || ''
    const scale = dealTextScale(deal) / 100
    const overlay = dealOverlay(deal) / 100
    const shadow = {textShadow: '0 1px 3px rgba(0,0,0,0.6)'}
    return (
        <div
            className="relative rounded-card overflow-hidden h-[220px] flex flex-col justify-end p-6 cursor-pointer group"
            onClick={onClick}
        >
            {img && plainImage && <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            {img && !plainImage && (
                <Image
                    src={img}
                    alt={deal.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
            )}
            {!img && <div className="absolute inset-0 bg-navy" />}

            <div className="absolute inset-0 bg-black" style={{opacity: overlay}} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

            <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-orange text-white text-[11px] font-bold px-3 py-1 rounded-full font-syne">
                <Tag size={10} />
                {deal.badge}
            </div>

            <div className="relative z-10">
                <p className="text-white leading-[1.5] mb-2.5 max-w-[360px]" style={{fontSize: `${14 * scale}px`, ...shadow}}>
                    <span className="font-bold">{deal.title}</span> — {deal.description}
                </p>
                <div className="font-syne font-extrabold text-orange leading-none mb-2" style={{fontSize: `${3 * scale}rem`, ...shadow}}>
                    {deal.value}
                    {deal.unit && <span style={{fontSize: `${1.2 * scale}rem`}}>{deal.unit}</span>}
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-white/80 group-hover:text-white transition-colors" style={shadow}>
                    {viewLabel} <ArrowRight size={12} />
                </div>
            </div>
        </div>
    )
}
