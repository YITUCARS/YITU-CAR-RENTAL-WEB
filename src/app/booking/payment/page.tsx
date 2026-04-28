'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CreditCard, Shield, Check, AlertCircle, Loader } from 'lucide-react'
import { useBooking, calcAfterHourBreakdown, splitMandatoryFees, formatAfterHourFeeLabel } from '@/lib/booking-context'
import BookingFlowHeader from '@/components/booking/BookingFlowHeader'
import Navbar from '@/components/layout/Navbar'

const YOUNG_DRIVER_FEE_PER_DAY = 30

function PaymentContent() {
    const router = useRouter()
    const params = useSearchParams()
    const { booking, setBooking, isHydrated } = useBooking()
    const [paymentType, setPaymentType] = useState<'deposit' | 'full'>('deposit')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [optionalFees, setOptionalFees] = useState<any[]>([])
    const [mandatoryFees, setMandatoryFees] = useState<any[]>([])

    const totalFromUrl = Number(params.get('total')) || 0
    const daysFromUrl = Number(params.get('days')) || booking.days
    const pricePerDayFromUrl = Number(params.get('pricePerDay')) || booking.pricePerDay

    useEffect(() => {
        if (!isHydrated) return
        if (!booking.vehicleId || !booking.vehicleCategoryTypeId) return

        fetch('/api/rcm/step3', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vehicleCategoryTypeId: booking.vehicleCategoryTypeId || 0,
                vehicleCategoryId: Number(booking.vehicleId),
                pickupLocation: booking.pickupLocation,
                dropoffLocation: booking.dropoffLocation,
                pickupDate: booking.pickupDate,
                dropoffDate: booking.dropoffDate,
                pickupTime: booking.pickupTime,
                dropoffTime: booking.dropoffTime,
                promoCode: booking.promoCode,
            }),
        })
            .then(r => r.json())
            .then(res => {
                if (!res.success || !res.data) return
                setOptionalFees(Array.isArray(res.data.optionalfees) ? res.data.optionalfees : [])
                setMandatoryFees(Array.isArray(res.data.mandatoryfees) ? res.data.mandatoryfees : [])
            })
            .catch(err => console.error('payment step3 error:', err))
    }, [
        isHydrated,
        booking.vehicleCategoryTypeId,
        booking.vehicleId,
        booking.pickupLocation,
        booking.dropoffLocation,
        booking.pickupDate,
        booking.dropoffDate,
        booking.pickupTime,
        booking.dropoffTime,
        booking.promoCode,
    ])

    const baseVehicleTotal = (booking.basePricePerDay || pricePerDayFromUrl || booking.pricePerDay) * daysFromUrl
    const discountedVehicleTotal = Math.max(0, baseVehicleTotal - booking.promoDiscountAmount)
    const calculatedAfterHour = calcAfterHourBreakdown(booking.pickupTime, booking.dropoffTime)
    const youngDriverTotal = booking.driverAge === 'under26' ? YOUNG_DRIVER_FEE_PER_DAY * daysFromUrl : 0

    const selectedInsurance = booking.insuranceOptions.find(i => i.id === booking.selectedInsuranceId) || null
    const insuranceTotal = selectedInsurance && selectedInsurance.fees > 0
        ? selectedInsurance.fees * daysFromUrl
        : 0

    const selectedMandatoryFees = mandatoryFees.filter(fee => (booking.mandatoryFeeIds || []).includes(fee.id))
    const { afterHourFees, otherFees: nonAfterHourMandatoryFees } = splitMandatoryFees(selectedMandatoryFees)
    const afterHourTotal = afterHourFees.length > 0
        ? afterHourFees.reduce((sum, fee) => sum + (fee.fees || 0), 0)
        : (booking.afterHourFee || calculatedAfterHour.total)
    const relocationTotal = nonAfterHourMandatoryFees.length > 0
        ? nonAfterHourMandatoryFees.reduce((sum, fee) => sum + (fee.fees || 0), 0)
        : booking.relocationFee

    const selectedExtras = optionalFees
        .map(extra => {
            const qty = booking.extras?.[String(extra.id)] || 0
            if (qty <= 0) return null
            const multiplier = extra.type === 'Daily' ? daysFromUrl : 1
            const total = extra.maximumprice > 0
                ? Math.min(extra.fees * qty * multiplier, extra.maximumprice * qty)
                : extra.fees * qty * multiplier
            return { ...extra, qty, total }
        })
        .filter(Boolean) as Array<any>

    const extrasTotal = selectedExtras.reduce((sum, extra) => sum + extra.total, 0)
    const computedGrandTotal = discountedVehicleTotal + insuranceTotal + extrasTotal + youngDriverTotal + afterHourTotal + relocationTotal
    const fallbackTotal = pricePerDayFromUrl * daysFromUrl
    const fullAmount = booking.totalAmount > 0 ? booking.totalAmount : (totalFromUrl > 0 ? totalFromUrl : (computedGrandTotal > 0 ? computedGrandTotal : fallbackTotal))
    const depositAmount = Math.round(fullAmount * 0.1 * 100) / 100
    const payAmount = paymentType === 'deposit' ? depositAmount : fullAmount

    if (!isHydrated) {
        return (
            <>
                <Navbar onManageBooking={() => {}} />
                <BookingFlowHeader current={5} />
                <main className="max-w-[900px] mx-auto px-10 py-10">
                    <div className="flex flex-col gap-4">
                        <div className="bg-white border border-black/10 rounded-card h-72 animate-pulse" />
                    </div>
                </main>
            </>
        )
    }

    async function handlePay() {
        setLoading(true)
        setError('')
        try {
            // ── Read the freshest booking data from sessionStorage ────────────────
            // The details page writes to sessionStorage synchronously before
            // router.push(), but React context may not have flushed yet by the
            // time this component rendered. sessionStorage is always up-to-date.
            let freshBooking = { ...booking }
            try {
                const raw = sessionStorage.getItem('yitu-booking')
                if (raw) {
                    const parsed = JSON.parse(raw)
                    freshBooking = { ...freshBooking, ...parsed }
                }
            } catch {}
            console.log('[payment] freshBooking:', freshBooking)
            // ── Step 1: Always create a fresh booking so extras/insurance are
            //   correctly registered in RCM and the reservation total matches
            //   the payment amount sent to VostroPay.
            const bookingRes = await fetch('/api/rcm/create-booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pickupDate: freshBooking.pickupDate,
                    pickupTime: freshBooking.pickupTime,
                    dropoffDate: freshBooking.dropoffDate,
                    dropoffTime: freshBooking.dropoffTime,
                    pickupLocationId: freshBooking.pickupLocationId,
                    dropoffLocationId: freshBooking.dropoffLocationId,
                    vehicleCategoryId: Number(freshBooking.vehicleId),
                    vehicleCategoryTypeId: freshBooking.vehicleCategoryTypeId,
                    selectedInsuranceId: freshBooking.selectedInsuranceId,
                    extras: freshBooking.extras,
                    driverAge: freshBooking.driverAge,
                    firstName: freshBooking.firstName,
                    lastName: freshBooking.lastName,
                    email: freshBooking.email,
                    phone: (() => {
                        const raw = (freshBooking.phone || '').trim()
                        if (raw.startsWith('+')) return raw.replace(/\s+/g, '')

                        const dialCode = freshBooking.phoneDialCode || '+64'
                        const localNumber = raw.replace(/\D/g, '').replace(/^0+/, '')
                        return `${dialCode}${localNumber}`
                    })(),
                    flightNumber: freshBooking.flightNumber,
                    notes: freshBooking.notes,
                    promoCode: freshBooking.promoCode,
                    mandatoryFeeIds: freshBooking.mandatoryFeeIds || [],
                }),
            })
            const bookingData = await bookingRes.json()
            if (!bookingData.success) throw new Error(bookingData.error || 'Failed to create booking')
            const reservationRef = bookingData.reservationRef
            const reservationNo = bookingData.reservationNo

            // ── Step 2: Create payment transaction on the (possibly reused) reservation
            const paymentRes = await fetch('/api/rcm/create-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservationRef,
                    amount: payAmount,
                    payScenario: 1,
                }),
            })
            const paymentData = await paymentRes.json()
            if (!paymentData.success) throw new Error(paymentData.error || 'Failed to create payment')

            const { RedirectUrl } = paymentData.data

            // Persist to sessionStorage synchronously before navigating away —
            // React state updates won't flush before window.location.href leaves.
            const updatedBooking = { ...freshBooking, reservationRef, reservationNo, paymentType }
            try { sessionStorage.setItem('yitu-booking', JSON.stringify(updatedBooking)) } catch {}
            setBooking(_ => updatedBooking)

            if (RedirectUrl) {
                window.location.href = RedirectUrl
            } else {
                throw new Error('No redirect URL from payment gateway')
            }
        } catch (err: any) {
            setError(err.message || 'Payment failed, please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Navbar onManageBooking={() => {}} />

            <BookingFlowHeader
                current={5}
                onBack={() => router.back()}
                summary={
                    <div className="text-[13px] text-muted">
                        Selected: <span className="text-navy font-semibold">{booking.vehicleName}</span>
                        <span className="mx-2">·</span>
                        <span className="text-orange font-semibold">{daysFromUrl} days</span>
                    </div>
                }
            />

            <main className="max-w-[900px] mx-auto px-10 py-10">
                <div className="flex gap-8 items-start flex-col lg:flex-row">
                    <div className="flex-1">
                        <h2 className="font-syne font-bold text-navy text-xl mb-6">Select Payment Option</h2>

                        <div className="flex flex-col gap-3 mb-6">
                            <button
                                onClick={() => setPaymentType('deposit')}
                                className={`text-left bg-white border rounded-card p-5 flex items-start gap-4 transition-all w-full ${
                                    paymentType === 'deposit'
                                        ? 'border-orange/50 shadow-card'
                                        : 'border-black/10 hover:border-orange/20'
                                }`}
                            >
                                <div
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                                        paymentType === 'deposit' ? 'bg-orange' : 'bg-orange/10'
                                    }`}
                                >
                                    <CreditCard size={20} className={paymentType === 'deposit' ? 'text-white' : 'text-orange'} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <div className="font-syne font-bold text-[14px] text-navy">Pay 10% Deposit</div>
                                        {paymentType === 'deposit' && (
                                            <div className="w-5 h-5 bg-orange rounded-full flex items-center justify-center flex-shrink-0">
                                                <Check size={11} className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-[12.5px] text-muted mt-0.5 leading-relaxed">
                                        Secure your booking with a 10% deposit. Remaining balance due on pickup.
                                    </div>
                                    <div className="text-[16px] font-syne font-bold text-orange mt-1.5">
                                        ${depositAmount.toLocaleString()} NZD
                                        <span className="text-[11px] text-muted font-normal ml-2">
                                            (balance ${(fullAmount - depositAmount).toLocaleString()} on pickup)
                                        </span>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => setPaymentType('full')}
                                className={`text-left bg-white border rounded-card p-5 flex items-start gap-4 transition-all w-full ${
                                    paymentType === 'full'
                                        ? 'border-orange/50 shadow-card'
                                        : 'border-black/10 hover:border-orange/20'
                                }`}
                            >
                                <div
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                                        paymentType === 'full' ? 'bg-orange' : 'bg-orange/10'
                                    }`}
                                >
                                    <Shield size={20} className={paymentType === 'full' ? 'text-white' : 'text-orange'} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <div className="font-syne font-bold text-[14px] text-navy">Pay Full Amount</div>
                                        {paymentType === 'full' && (
                                            <div className="w-5 h-5 bg-orange rounded-full flex items-center justify-center flex-shrink-0">
                                                <Check size={11} className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-[12.5px] text-muted mt-0.5 leading-relaxed">
                                        Pay the full amount now. No additional payment required at pickup.
                                    </div>
                                    <div className="text-[16px] font-syne font-bold text-orange mt-1.5">
                                        ${fullAmount.toLocaleString()} NZD
                                    </div>
                                </div>
                            </button>

                        </div>

                        {error && (
                            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                                <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-red-600 text-[13px]">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={handlePay}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[15px] py-4 rounded-xl transition-all shadow-orange-glow disabled:opacity-60"
                        >
                            <CreditCard size={18} />
                            {loading ? 'Processing...' : `Pay $${payAmount.toLocaleString()} NZD`}
                        </button>
                        <p className="text-[11px] text-muted text-center mt-3">
                            You will be securely redirected to complete your payment
                        </p>
                    </div>

                    <div className="lg:w-72 flex-shrink-0 sticky top-24">
                        <div className="bg-white border border-black/10 rounded-card p-5">
                            <h3 className="font-syne font-bold text-navy text-[15px] mb-4">Booking Summary</h3>
                            <div className="space-y-2 text-[13px] text-muted mb-4">
                                <div className="flex justify-between">
                                    <span>Vehicle</span>
                                    <span className="text-navy font-medium text-right max-w-[140px] truncate">{booking.vehicleName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Pick-up</span>
                                    <span className="text-navy font-medium">{booking.pickupDate}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Drop-off</span>
                                    <span className="text-navy font-medium">{booking.dropoffDate}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Duration</span>
                                    <span className="text-orange font-semibold">{daysFromUrl} days</span>
                                </div>
                            </div>
                            <div className="border-t border-black/10 pt-3 space-y-2 text-[13px]">
                                <div className="flex justify-between text-muted">
                                    <span className="truncate max-w-[150px]">{booking.vehicleName || 'Vehicle'}</span>
                                    <span>${discountedVehicleTotal.toLocaleString()}</span>
                                </div>
                                <div className="text-[11px] text-muted">
                                    {daysFromUrl} day{daysFromUrl !== 1 ? 's' : ''} × ${(booking.pricePerDay || pricePerDayFromUrl).toLocaleString()}/day
                                </div>
                                {booking.promoDiscountAmount > 0 && (
                                    <div className="flex justify-between text-green-700 text-[12px]">
                                        <span>Promo {booking.promoCode}</span>
                                        <span>- ${booking.promoDiscountAmount.toLocaleString()}</span>
                                    </div>
                                )}

                                {afterHourFees.length > 0 ? afterHourFees.map(fee => (
                                    <div key={fee.id} className="flex justify-between text-muted">
                                        <span className="truncate max-w-[150px]">{formatAfterHourFeeLabel(fee)}</span>
                                        <span>+${Number(fee.fees || 0).toLocaleString()}</span>
                                    </div>
                                )) : calculatedAfterHour.pickupFee > 0 && (
                                    <div className="flex justify-between text-muted">
                                        <span>After-hours pickup</span>
                                        <span>+${calculatedAfterHour.pickupFee.toLocaleString()}</span>
                                    </div>
                                )}
                                {!afterHourFees.length && calculatedAfterHour.dropoffFee > 0 && (
                                    <div className="flex justify-between text-muted">
                                        <span>After-hours return</span>
                                        <span>+${calculatedAfterHour.dropoffFee.toLocaleString()}</span>
                                    </div>
                                )}

                                {nonAfterHourMandatoryFees.map(fee => (
                                    <div key={fee.id} className="flex justify-between text-muted">
                                        <span className="truncate max-w-[150px]">{fee.name || 'One-Way Fee'}</span>
                                        <span>+${Number(fee.fees || 0).toLocaleString()}</span>
                                    </div>
                                ))}

                                {!nonAfterHourMandatoryFees.length && relocationTotal > 0 && (
                                    <div className="flex justify-between text-muted">
                                        <span>Relocation Fee</span>
                                        <span>+${relocationTotal.toLocaleString()}</span>
                                    </div>
                                )}

                                {youngDriverTotal > 0 && (
                                    <div className="flex justify-between text-muted">
                                        <span>Young Driver Fee</span>
                                        <span>+${youngDriverTotal.toLocaleString()}</span>
                                    </div>
                                )}

                                {selectedInsurance && (
                                    <div className="flex justify-between text-muted">
                                        <span className="truncate max-w-[150px]">{selectedInsurance.name}</span>
                                        <span>{insuranceTotal > 0 ? `+$${insuranceTotal.toLocaleString()}` : 'Included'}</span>
                                    </div>
                                )}

                                {selectedExtras.map(extra => (
                                    <div key={extra.id} className="flex justify-between text-muted">
                                        <span className="truncate max-w-[150px]">{extra.name} ×{extra.qty}</span>
                                        <span>+${Number(extra.total || 0).toLocaleString()}</span>
                                    </div>
                                ))}

                                <div className="border-t border-black/[0.07] pt-2 mt-2 flex justify-between text-muted">
                                    <span>Total booking</span>
                                    <span>${fullAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-muted">
                                    <span>Paying now</span>
                                    <span className="text-orange font-syne font-extrabold text-[15px]">${payAmount.toLocaleString()}</span>
                                </div>
                                {paymentType === 'deposit' && (
                                    <div className="flex justify-between text-muted text-[11px]">
                                        <span>Due at pickup</span>
                                        <span>${(fullAmount - depositAmount).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    )
}

export default function PaymentPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-off-white flex items-center justify-center">
                    <Loader size={32} className="text-orange animate-spin" />
                </div>
            }
        >
            <PaymentContent />
        </Suspense>
    )
}
