import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

const STEPS = [
    { n: 1, labelKey: 'BookingSteps.search' },
    { n: 2, labelKey: 'BookingSteps.chooseVehicle' },
    { n: 3, labelKey: 'BookingSteps.extras' },
    { n: 4, labelKey: 'BookingSteps.yourDetails' },
]

export default function BookingSteps({ current }: { current: number }) {
    const t = useTranslations()

    return (
        <div className="flex items-center gap-0 w-full max-w-xl mx-auto">
            {STEPS.map((step, i) => {
                const done = step.n < current
                const active = step.n === current
                return (
                    <div key={step.n} className="flex items-center flex-1">
                        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-syne font-bold transition-all
                ${done ? 'bg-orange text-white' : active ? 'bg-navy text-white' : 'bg-black/10 text-muted'}`}>
                                {done ? <Check size={14} /> : step.n}
                            </div>
                            <span className={`text-[10.5px] font-medium whitespace-nowrap
                ${active ? 'text-navy font-bold' : done ? 'text-orange' : 'text-muted'}`}>
                {t(step.labelKey)}
              </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className={`h-[2px] flex-1 mx-2 mb-4 rounded transition-all
                ${done ? 'bg-orange' : 'bg-black/10'}`} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
