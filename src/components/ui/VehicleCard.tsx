'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Heart, Users, Briefcase, Fuel, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { VehicleRecord } from '@/lib/db'

interface VehicleCardProps {
  vehicle: VehicleRecord
  onBook: () => void
}

const FUEL_ICON: Record<string, string> = {
  Hybrid: '🌿',
  Electric: '⚡',
  Petrol: '⛽',
  Diesel: '🛢',
}

export default function VehicleCard({ vehicle, onBook }: VehicleCardProps) {
  const [liked, setLiked] = useState(false)
  const t = useTranslations()

  return (
    <div className="bg-off-white border border-black/10 rounded-card overflow-hidden flex flex-col transition-all duration-250 hover:-translate-y-[5px] hover:border-orange/35 hover:shadow-card-hover group">
      {/* Header */}
      <div className="px-[18px] pt-[18px] flex justify-between items-start">
        <div>
          <div className="text-[10.5px] text-muted uppercase tracking-[0.7px]">
            {vehicle.brand} · {vehicle.category.toUpperCase()}
          </div>
          <div className="font-syne font-bold text-[15px] text-navy mt-1 leading-tight">
            {vehicle.model}
          </div>
        </div>
        <button
          onClick={() => setLiked(!liked)}
          className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all flex-shrink-0 ${
            liked
              ? 'bg-orange/15 border-orange text-orange'
              : 'bg-white border-black/10 text-muted hover:bg-orange/15 hover:border-orange hover:text-orange'
          }`}
          aria-label={t('VehicleCard.favourite')}
        >
          <Heart size={12} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Image */}
      <div className="px-[18px] py-2.5">
        <Image
          src={vehicle.image}
          alt={vehicle.model}
          width={632}
          height={336}
          className="w-full h-[170px] object-cover rounded-lg"
        />
      </div>

      {/* Specs */}
      <div className="flex gap-3.5 flex-wrap px-[18px] pb-3.5 border-b border-black/10">
        <span className="flex items-center gap-1 text-[12px] text-muted">
          <Users size={10} className="text-orange" />{t('VehicleCard.seats', {count: vehicle.seats})}
        </span>
        <span className="flex items-center gap-1 text-[12px] text-muted">
          <Briefcase size={10} className="text-orange" />{t('VehicleCard.bags', {count: vehicle.bags})}
        </span>
        <span className="flex items-center gap-1 text-[12px] text-muted">
          <Fuel size={10} className="text-orange" />{vehicle.fuel}
        </span>
        <span className="flex items-center gap-1 text-[12px] text-muted">
          <span className="text-[10px]">{FUEL_ICON[vehicle.fuel] || '🚗'}</span>
          {vehicle.drive}
        </span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 px-[18px] pt-3">
        {vehicle.tags.map((tag) => (
          <span
            key={tag}
            className="bg-navy/[0.05] text-muted text-[10.5px] px-2.5 py-0.5 rounded border border-black/10"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="px-[18px] py-3.5 flex items-center justify-between mt-auto">
        <div>
          <div className="text-[10px] text-muted mb-0.5">{t('VehicleCard.startFrom')}</div>
          <div className="font-syne font-extrabold text-[22px] text-navy leading-none">
            ${vehicle.price_per_day}
            <span className="text-[13px] text-muted font-normal"> {t('Common.perDay')}</span>
          </div>
        </div>
        <button
          onClick={onBook}
          className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-5 py-2.5 rounded-lg transition-all hover:scale-[1.04]"
        >
          <ArrowRight size={13} />
          {t('Navbar.bookNow')}
        </button>
      </div>
    </div>
  )
}
