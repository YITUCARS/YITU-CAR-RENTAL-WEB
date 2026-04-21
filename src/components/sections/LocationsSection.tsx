import {MapPin} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {LOCATIONS} from '@/lib/data'

export default function LocationsSection() {
  const t = useTranslations()

  return (
    <section id="locations" className="py-20 px-10 bg-off-white border-t border-black/10">
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center gap-2 text-[11.5px] text-orange uppercase tracking-[2.5px] font-bold mb-2.5 before:content-[''] before:w-5 before:h-0.5 before:bg-orange">
          {t('LocationsSection.kicker')}
        </div>
        <h2 className="font-montserrat font-extrabold italic text-[clamp(1.8rem,3vw,2.8rem)] text-navy leading-[1.1]">
          {t('LocationsSection.titlePrefix')} <span className="text-orange">{t('LocationsSection.titleAccent')}</span>
        </h2>
        <p className="text-muted text-[14.5px] leading-[1.75] max-w-[520px] mt-2.5 mb-11">
          {t('LocationsSection.subtitle')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[640px] mx-auto">
          {LOCATIONS.map(loc => (
            <div
              key={loc.id}
              className="relative bg-white border border-black/10 rounded-card px-[22px] py-7 text-center overflow-hidden transition-all hover:-translate-y-1 hover:border-orange/25 group"
            >
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-orange scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />

              <MapPin size={28} className="text-orange mx-auto mb-3.5" />
              <h3 className="font-syne font-bold text-[17px] text-navy mb-1.5">{t(`Locations.cards.${loc.id}.city`)}</h3>
              <p className="text-muted text-[13px] leading-[1.6]">
                {t(`Locations.cards.${loc.id}.address`)}<br />{t(`Locations.cards.${loc.id}.suburb`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
