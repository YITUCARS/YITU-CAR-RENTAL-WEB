'use client'

import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

interface MobileBookingSummaryProps {
  title?: string
  subtitle?: string
  totalLabel?: string
  total: string
  children: ReactNode
}

export default function MobileBookingSummary({
  title = 'Booking Summary',
  subtitle,
  totalLabel = 'Total',
  total,
  children,
}: MobileBookingSummaryProps) {
  return (
    <details className="group sticky top-3 z-40 mx-auto mb-6 block w-full max-w-[420px] overflow-hidden rounded-[22px] border border-orange/25 bg-white/95 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="font-syne text-[13px] font-extrabold uppercase tracking-[0.16em] text-navy">
            {title}
          </div>
          {subtitle && (
            <div className="mt-0.5 truncate text-[11px] font-medium text-muted">
              {subtitle}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              {totalLabel}
            </div>
            <div className="font-syne text-[18px] font-extrabold leading-none text-orange">
              {total}
            </div>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange/10 text-orange transition-transform group-open:rotate-180">
            <ChevronDown size={18} />
          </span>
        </div>
      </summary>
      <div className="max-h-[48vh] overflow-y-auto border-t border-black/10 px-4 py-4">
        {children}
      </div>
    </details>
  )
}
