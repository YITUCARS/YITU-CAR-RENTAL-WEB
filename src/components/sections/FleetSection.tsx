'use client'

import Image from 'next/image'
import {ArrowRight, Users, Briefcase} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useRouter} from '@/i18n/navigation'

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

export default function FleetSection({initialVehicles = []}: {initialVehicles?: FeaturedVehicle[]}) {
    const t = useTranslations()
    const router = useRouter()
    const filtered = initialVehicles.slice(0, 6)

    const goToBooking = () => router.push('/booking/vehicles')

    return (
        <section id="fleet" className="py-20 px-10">
            <div className="max-w-[1100px] mx-auto">
                <div className="flex items-start justify-between mb-10 flex-wrap gap-5">
                    <div>
                        <div className="flex items-center gap-2 text-[11.5px] text-orange uppercase tracking-[2.5px] font-bold mb-2.5 before:content-[''] before:w-5 before:h-0.5 before:bg-orange">
                            {t('FleetSection.kicker')}
                        </div>
                        <h2 className="font-montserrat font-extrabold italic text-[clamp(1.8rem,3vw,2.8rem)] text-navy leading-[1.1]">
                            {t('FleetSection.titlePrefix')} <span className="text-orange">{t('FleetSection.titleAccent')}</span>
                        </h2>
                        <p className="text-muted text-[14.5px] leading-[1.75] max-w-[400px] mt-2.5">
                            {t('FleetSection.subtitle')}
                        </p>
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className="text-center py-16 text-muted text-[14px]">
                        {t('FleetSection.empty')}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
                        {filtered.map(vehicle => (
                            <div
                                key={vehicle.rcm_category_id}
                                className="bg-white border border-black/10 rounded-card overflow-hidden hover:border-orange/30 hover:shadow-card transition-all group"
                            >
                                <div className="relative bg-off-white h-48 flex items-center justify-center overflow-hidden">
                                    {vehicle.image_url ? (
                                        <Image
                                            src={vehicle.image_url}
                                            alt={vehicle.name}
                                            fill
                                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="text-muted/30 text-sm">{t('Common.noImage')}</div>
                                    )}
                                </div>

                                <div className="p-5">
                                    <h3 className="font-syne font-bold text-navy text-[16px] leading-tight mb-2.5">
                                        {vehicle.name}
                                    </h3>
                                    <div className="flex items-center gap-4 text-[12.5px] text-muted mb-4">
                                        <span className="flex items-center gap-1.5">
                                            <Users size={12} className="text-orange" />
                                            {t('FleetSection.adults', {count: vehicle.seats})}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Briefcase size={12} className="text-orange" />
                                            {t('FleetSection.bags', {large: vehicle.large_bags, small: vehicle.small_bags})}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="font-syne font-extrabold text-[1.5rem] text-navy leading-none">
                                                ${vehicle.price_per_day}
                                            </span>
                                            <span className="text-[12px] text-muted ml-1">{t('Common.perDay')}</span>
                                        </div>
                                        <button
                                            onClick={goToBooking}
                                            className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[12.5px] px-4 py-2.5 rounded-xl transition-all shadow-orange-glow hover:scale-[1.03]"
                                        >
                                            {t('Navbar.bookNow')} <ArrowRight size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="text-center mt-10">
                    <button
                        onClick={goToBooking}
                        className="inline-flex items-center gap-2 bg-transparent border-[1.5px] border-orange text-orange font-syne font-bold text-[14px] px-8 py-3 rounded-full transition-all hover:bg-orange hover:text-white"
                    >
                        {t('FleetSection.viewAll')}
                        <ArrowRight size={15} />
                    </button>
                </div>
            </div>
        </section>
    )
}
