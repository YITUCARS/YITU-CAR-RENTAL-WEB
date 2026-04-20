'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, ArrowLeft, Loader } from 'lucide-react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'

function ConfirmationContent() {
    const params = useSearchParams()
    const ref = params.get('ref')   // long reservationref
    const no  = params.get('no')    // short reservationno (numeric)

    return (
        <>
            <Navbar onManageBooking={() => {}} />
            <div className="min-h-screen bg-off-white flex items-center justify-center px-10 pt-[80px]">
                <div className="bg-white border border-black/10 rounded-card p-10 max-w-[520px] w-full text-center shadow-card">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={36} className="text-green-500" />
                    </div>
                    <h1 className="font-syne font-extrabold text-navy text-[2rem] mb-3">
                        Booking Confirmed!
                    </h1>
                    <p className="text-muted text-[15px] leading-relaxed mb-6">
                        Your reservation has been successfully created. A confirmation email will be sent to you shortly.
                    </p>
                    {(ref || no) && (
                        <div className="bg-off-white border border-black/10 rounded-xl px-6 py-5 mb-6 text-left space-y-3">
                            {no && (
                                <div>
                                    <div className="text-[11px] text-muted uppercase tracking-wider mb-1">
                                        Booking Number
                                    </div>
                                    <div className="font-syne font-extrabold text-navy text-[1.6rem]">
                                        {no}
                                    </div>
                                </div>
                            )}
                            {ref && (
                                <div>
                                    <div className="text-[11px] text-muted uppercase tracking-wider mb-1">
                                        Reservation Reference
                                    </div>
                                    <div className="font-mono text-[13px] text-muted break-all">
                                        {ref}
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-2 bg-orange/[0.07] border border-orange/20 rounded-lg px-3 py-2.5 text-[12px] text-orange/90 leading-[1.5]">
                                <span className="mt-px">💡</span>
                                <span>Save this reference — you&apos;ll need it with your last name to view or cancel your booking via <strong>My Booking</strong>.</span>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col gap-3">
                        <Link
                            href="/"
                            className="w-full flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[14px] py-3.5 rounded-xl transition-colors"
                        >
                            Back to Home
                        </Link>
                        <Link
                            href="/fleet"
                            className="w-full flex items-center justify-center gap-2 bg-transparent border border-black/10 text-navy font-syne font-bold text-[14px] py-3.5 rounded-xl hover:border-orange transition-colors"
                        >
                            <ArrowLeft size={14} /> View More Vehicles
                        </Link>
                    </div>
                </div>
            </div>
        </>
    )
}

export default function ConfirmationPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-off-white flex items-center justify-center">
                    <Loader size={32} className="text-orange animate-spin" />
                </div>
            }
        >
            <ConfirmationContent />
        </Suspense>
    )
}
