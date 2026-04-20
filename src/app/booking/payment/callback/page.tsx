'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'

// ─── Inner component (needs Suspense because of useSearchParams) ──────────────

function CallbackContent() {
    const router = useRouter()
    const params = useSearchParams()
    const [status, setStatus] = useState<'processing' | 'success' | 'failed'>('processing')
    const [error, setError] = useState('')

    useEffect(() => {
        const successParam = params.get('success') || params.get('status')

        // Priority 1: URL param — VostroPay echoes it back via our successurl
        // Priority 2: sessionStorage — written synchronously before VostroPay redirect
        let reservationRef = params.get('reservationRef') || ''
        let reservationNo = ''
        try {
            const raw = sessionStorage.getItem('yitu-booking')
            if (raw) {
                const parsed = JSON.parse(raw)
                if (!reservationRef) reservationRef = parsed.reservationRef || ''
                reservationNo = parsed.reservationNo || ''
            }
        } catch {}

        // ── VostroPay payscenario=1 (hosted payment page) ───────────────────────
        // VostroPay communicates directly with RCM when the card is charged,
        // creating the payment record (Visa/Mastercard) automatically.
        // We must NOT call confirmpayment ourselves — it would add a duplicate
        // VostroPay entry and inflate the RCM balance.
        // Just check success/fail and route accordingly.

        if (
            successParam === 'false' ||
            successParam === '0' ||
            successParam === 'failed'
        ) {
            setStatus('failed')
            setError('Payment was cancelled or failed. Please try again.')
            return
        }

        // Payment confirmed by VostroPay — navigate to confirmation
        setStatus('success')
        setTimeout(() => {
            const query = new URLSearchParams()
            if (reservationRef) query.set('ref', reservationRef)
            if (reservationNo) query.set('no', reservationNo)
            router.push(`/booking/confirmation?${query.toString()}`)
        }, 2000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <>
            <Navbar onManageBooking={() => {}} />
            <div className="min-h-screen bg-off-white flex items-center justify-center px-10 pt-[80px]">
                <div className="bg-white border border-black/10 rounded-card p-10 max-w-[480px] w-full text-center shadow-card">

                    {status === 'processing' && (
                        <>
                            <div className="w-16 h-16 bg-orange/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Loader size={32} className="text-orange animate-spin" />
                            </div>
                            <h1 className="font-syne font-extrabold text-navy text-[1.8rem] mb-3">
                                Processing Payment
                            </h1>
                            <p className="text-muted text-[14px]">
                                Please wait while we confirm your payment…
                            </p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle size={36} className="text-green-500" />
                            </div>
                            <h1 className="font-syne font-extrabold text-navy text-[1.8rem] mb-3">
                                Payment Successful!
                            </h1>
                            <p className="text-muted text-[14px]">
                                Redirecting to your booking confirmation…
                            </p>
                        </>
                    )}

                    {status === 'failed' && (
                        <>
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <XCircle size={36} className="text-red-500" />
                            </div>
                            <h1 className="font-syne font-extrabold text-navy text-[1.8rem] mb-3">
                                Payment Failed
                            </h1>
                            <p className="text-muted text-[14px] mb-6">
                                {error || 'Something went wrong with your payment.'}
                            </p>
                            <button
                                onClick={() => router.back()}
                                className="w-full bg-orange text-white font-syne font-bold py-3.5 rounded-xl"
                            >
                                Try Again
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}

// ─── Page export — Suspense required by Next.js 14 for useSearchParams ────────

export default function PaymentCallbackPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-off-white flex items-center justify-center">
                    <Loader size={32} className="text-orange animate-spin" />
                </div>
            }
        >
            <CallbackContent />
        </Suspense>
    )
}
