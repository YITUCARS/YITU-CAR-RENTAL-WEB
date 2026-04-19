import { Users, MapPin, Infinity } from 'lucide-react'

const STATS = [
  { icon: Users, value: '10,000', suffix: '+', label: 'Happy Customers' },
  { icon: Infinity, value: 'Unlimited', suffix: '', label: 'Kilometres Included' },
  { icon: MapPin, value: '3', suffix: ' Cities', label: 'NZ Locations' },
]

export default function StatsStrip() {
  return (
    <div className="bg-off-white border-t border-b border-black/10 px-10">
      <div className="max-w-[1100px] mx-auto grid grid-cols-1 sm:grid-cols-3">
        {STATS.map(({ icon: Icon, value, suffix, label }, i) => (
          <div
            key={label}
            className={`text-center py-7 px-5 ${
              i < STATS.length - 1 ? 'border-b sm:border-b-0 sm:border-r border-black/10' : ''
            }`}
          >
            <Icon size={26} className="text-orange mx-auto mb-3" />
            <div className="font-syne font-extrabold text-navy mb-1.5 text-[clamp(1.8rem,3vw,2.6rem)]">
              {value}
              <em className="text-orange not-italic">{suffix}</em>
            </div>
            <div className="text-[12px] text-muted uppercase tracking-[0.8px]">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
