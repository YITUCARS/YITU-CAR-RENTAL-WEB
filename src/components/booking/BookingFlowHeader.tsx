'use client'

import React from 'react'
import { ArrowLeft } from 'lucide-react'
import BookingSteps from '@/components/booking/BookingSteps'

interface BookingFlowHeaderProps {
    current: number
    backLabel?: string
    onBack?: () => void
    summary?: React.ReactNode
}

export default function BookingFlowHeader({
    current,
    backLabel = 'Back',
    onBack,
    summary,
}: BookingFlowHeaderProps) {
    return (
        <div className="pt-[80px] relative overflow-hidden border-b border-black/8 bg-[linear-gradient(180deg,#f7fbff_0%,#eef4fb_100%)]">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-16 left-[8%] h-40 w-40 rounded-full bg-orange/10 blur-3xl" />
                <div className="absolute top-10 right-[10%] h-48 w-48 rounded-full bg-sky-200/30 blur-3xl" />
            </div>

            <div className="relative max-w-[1100px] mx-auto px-10 py-10">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-navy/60 hover:text-navy text-sm mb-6 transition-colors"
                    >
                        <ArrowLeft size={13} /> {backLabel}
                    </button>
                )}

                <BookingSteps current={current} />

                {summary && (
                    <div className="mt-7 rounded-[22px] border border-white/70 bg-white/80 backdrop-blur px-5 py-4 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
                        {summary}
                    </div>
                )}
            </div>
        </div>
    )
}
