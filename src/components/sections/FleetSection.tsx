'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, Users, Briefcase } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface FeaturedVehicle {
    slot: number
    rcm_category_id: number
    name: string
    image_url: string
    price_per_day: number
    seats: number
    large_bags: number
    small_bags: number
    category: string
}

export default function FleetSection() {
    const [vehicles, setVehicles] = useState<FeaturedVehicle[]>([])
    const [loading, setLoading] = useState(true)
    const [imgScales, setImgScales] = useState<Record<number, number>>({})
    const router = useRouter()

    useEffect(() => {
        fetch('/api/public/featured-vehicles', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => setVehicles(Array.isArray(data) ? data : []))
            .catch(() => setVehicles([]))
            .finally(() => setLoading(false))
    }, [])

    // When an image loads, read its natural aspect ratio and compute a normalizing scale.
    // Baseline is 2.5:1 (typical landscape car photo). Wider images appear shorter under
    // object-contain, so we scale them up to compensate. Cap at 1.8x to avoid over-cropping.
    const handleImageLoad = (id: number, e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth: w, naturalHeight: h } = e.currentTarget
        if (!h) return
        const ratio = w / h
        const baseRatio = 2.5
        const scale = ratio > baseRatio ? Math.min(ratio / baseRatio, 1.8) : 1
        setImgScales(prev => ({ ...prev, [id]: scale }))
    }

    const filtered = vehicles.slice(0, 6)

    const goToBooking = () => router.push('/booking/vehicles')

    return (
        <section id="fleet" className="py-20 px-10">
            <div className="max-w-[1100px] mx-auto">
                {/* Header */}
                <div className="flex items-start justify-between mb-10 flex-wrap gap-5">
                    <div>
                        <div className="flex items-center gap-2 text-[11.5px] text-orange uppercase tracking-[2.5px] font-bold mb-2.5 before:content-[''] before:w-5 before:h-0.5 before:bg-orange">
                            Our Fleet
                        </div>
                        <h2 className="font-montserrat font-extrabold italic text-[clamp(1.8rem,3vw,2.8rem)] text-navy leading-[1.1]">
                            Choose Your <span className="text-orange">Vehicle</span>
                        </h2>
                        <p className="text-muted text-[14.5px] leading-[1.75] max-w-[400px] mt-2.5">
                            From compact hybrids to premium vans — every vehicle includes unlimited kilometres and comprehensive insurance.
                        </p>
                    </div>

                </div>

                {/* Vehicle Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-white border border-black/10 rounded-card h-64 animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-muted text-[14px]">
                        暂无车辆数据，请在管理后台配置首页展示车型。
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
                        {filtered.map(vehicle => (
                            <div
                                key={vehicle.rcm_category_id}
                                className="bg-white border border-black/10 rounded-card overflow-hidden hover:border-orange/30 hover:shadow-card transition-all group"
                            >
                                {/* Image */}
                                <div className="relative bg-off-white h-48 flex items-center justify-center overflow-hidden">
                                    {vehicle.image_url ? (
                                        <>
                                            {/* Outer div applies adaptive aspect-ratio scale; inner img applies hover scale */}
                                            <div
                                                style={{ transform: `scale(${imgScales[vehicle.rcm_category_id] ?? 1})` }}
                                                className="w-full h-full flex items-center justify-center transition-transform duration-700"
                                            >
                                                <img
                                                    src={vehicle.image_url}
                                                    alt={vehicle.name}
                                                    onLoad={(e) => handleImageLoad(vehicle.rcm_category_id, e)}
                                                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-muted/30 text-sm">No image</div>
                                    )}
                                    <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-[10px] font-bold text-navy uppercase tracking-wide px-2.5 py-1 rounded-full border border-black/10">
                                        {vehicle.category}
                                    </span>
                                </div>

                                {/* Info */}
                                <div className="p-5">
                                    <h3 className="font-syne font-bold text-navy text-[16px] leading-tight mb-2.5">
                                        {vehicle.name}
                                    </h3>
                                    <div className="flex items-center gap-4 text-[12.5px] text-muted mb-4">
                                        <span className="flex items-center gap-1.5">
                                            <Users size={12} className="text-orange" />
                                            {vehicle.seats} Adults
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Briefcase size={12} className="text-orange" />
                                            {vehicle.large_bags} Large + {vehicle.small_bags} Small
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="font-syne font-extrabold text-[1.5rem] text-navy leading-none">
                                                ${vehicle.price_per_day}
                                            </span>
                                            <span className="text-[12px] text-muted ml-1">/day</span>
                                        </div>
                                        <button
                                            onClick={goToBooking}
                                            className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[12.5px] px-4 py-2.5 rounded-xl transition-all shadow-orange-glow hover:scale-[1.03]"
                                        >
                                            Book <ArrowRight size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* View all button */}
                <div className="text-center mt-10">
                    <button
                        onClick={goToBooking}
                        className="inline-flex items-center gap-2 bg-transparent border-[1.5px] border-orange text-orange font-syne font-bold text-[14px] px-8 py-3 rounded-full transition-all hover:bg-orange hover:text-white"
                    >
                        View All Vehicles
                        <ArrowRight size={15} />
                    </button>
                </div>
            </div>
        </section>
    )
}
