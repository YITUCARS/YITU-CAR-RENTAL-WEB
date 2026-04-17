'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Shield, Check, Minus, Plus, AlertCircle, Package, Users, Baby } from 'lucide-react'
import { useBooking, calcAfterHourBreakdown } from '@/lib/booking-context'
import BookingFlowHeader from '@/components/booking/BookingFlowHeader'
import Navbar from '@/components/layout/Navbar'

const YOUNG_DRIVER_FEE_ID = 15 // RCM Extra Fee ID for Young Driver Fee

function getIcon(name: string) {
    const n = name.toLowerCase()
    if (n.includes('baby') || n.includes('infant') || n.includes('child') || n.includes('booster')) return Baby
    if (n.includes('driver')) return Users
    return Package
}

export default function ExtrasPage() {
    const router = useRouter()
    const { booking, setBooking, isHydrated } = useBooking()
    const [extras, setExtras] = useState<Record<string, number>>(booking.extras || {})
    const [selectedInsuranceId, setSelectedInsuranceId] = useState<number | null>(booking.selectedInsuranceId)
    const [optionalFees, setOptionalFees] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const isUnder26 = booking.driverAge === 'under26'

    useEffect(() => {
        if (!isHydrated) return
        if (!booking.vehicleId || !booking.vehicleCategoryTypeId) {
            setLoading(false)
            return
        }

        setLoading(true)
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
                if (res.success && res.data?.optionalfees) {
                    // 过滤掉 Young Driver Fee（我们单独处理）
                    const fees = res.data.optionalfees.filter((f: any) => f.id !== YOUNG_DRIVER_FEE_ID)
                    setOptionalFees(fees)
                }
            })
            .catch(e => console.error('step3 error:', e))
            .finally(() => setLoading(false))
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
    ])

    // Young Driver Fee 从 step3 数据里取，或用默认值 30
    const youngDriverFeePerDay = 30
    const youngDriverTotal = isUnder26 ? youngDriverFeePerDay * booking.days : 0

    function changeExtra(id: string, delta: number, max: number) {
        setExtras(prev => {
            const current = prev[id] || 0
            const next = Math.min(max, Math.max(0, current + delta))
            return { ...prev, [id]: next }
        })
    }

    function calcInsuranceTotal() {
        if (selectedInsuranceId === null) return 0
        const ins = booking.insuranceOptions.find(i => i.id === selectedInsuranceId)
        if (!ins || ins.fees === 0) return 0
        return ins.fees * booking.days
    }

    function calcExtrasTotal() {
        return optionalFees.reduce((sum, e) => {
            const qty = extras[String(e.id)] || 0
            const multiplier = e.type === 'Daily' ? booking.days : 1
            const effectiveTotal = e.maximumprice > 0
                ? Math.min(e.fees * qty * multiplier, e.maximumprice * qty)
                : e.fees * qty * multiplier
            return sum + effectiveTotal
        }, 0)
    }

    const baseVehicleTotal = (booking.basePricePerDay || booking.pricePerDay) * booking.days
    const vehicleTotal = Math.max(0, baseVehicleTotal - booking.promoDiscountAmount)
    const insuranceTotal = calcInsuranceTotal()
    const extrasTotal = calcExtrasTotal()
    const afterHour = calcAfterHourBreakdown(booking.pickupTime, booking.dropoffTime)
    const grandTotal = vehicleTotal + insuranceTotal + extrasTotal + youngDriverTotal + afterHour.total

    function proceed() {
        setBooking(b => ({ ...b, extras, selectedInsuranceId, afterHourFee: afterHour.total, totalAmount: grandTotal }))
        router.push('/booking/details')
    }

    return (
        <>
            <Navbar onManageBooking={() => {}} />

            <BookingFlowHeader
                current={3}
                onBack={() => router.back()}
                summary={
                    <div className="text-[13px] text-muted">
                        Selected: <span className="text-navy font-semibold">{booking.vehicleName}</span>
                        <span className="mx-2">·</span>
                        <span className="text-orange font-semibold">{booking.days} days</span>
                    </div>
                }
            />

            <main className="max-w-[900px] mx-auto px-10 py-10">
                <div className="flex gap-8 items-start flex-col lg:flex-row">
                    <div className="flex-1 flex flex-col gap-6">

                        {/* Young Driver Fee */}
                        {isUnder26 && (
                            <div>
                                <h2 className="font-syne font-bold text-navy text-xl mb-3">Required Fee</h2>
                                <div className="bg-orange/5 border border-orange/30 rounded-card p-5 flex items-start gap-4">
                                    <div className="w-11 h-11 bg-orange/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <AlertCircle size={20} className="text-orange" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <div className="font-syne font-bold text-[14px] text-navy">Young Driver Fee</div>
                                            <span className="text-[11px] bg-orange/15 text-orange font-bold px-3 py-1 rounded-full flex-shrink-0">Required</span>
                                        </div>
                                        <div className="text-[12.5px] text-muted mt-0.5 leading-relaxed">
                                            Mandatory for drivers under 26 years old. $30 per day.
                                        </div>
                                        <div className="text-[12px] text-orange font-semibold mt-1.5">
                                            +${youngDriverFeePerDay}/day (${youngDriverTotal} total)
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Insurance */}
                        {booking.insuranceOptions.length > 0 && (
                            <div>
                                <h2 className="font-syne font-bold text-navy text-xl mb-3">Insurance</h2>
                                <div className="flex flex-col gap-3">
                                    {booking.insuranceOptions.map(ins => (
                                        <button key={ins.id} onClick={() => setSelectedInsuranceId(ins.id)}
                                                className={`text-left bg-white border rounded-card p-5 flex items-start gap-4 transition-all w-full
                        ${selectedInsuranceId === ins.id ? 'border-orange/50 shadow-card' : 'border-black/10 hover:border-orange/20'}`}>
                                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
                        ${selectedInsuranceId === ins.id ? 'bg-orange' : 'bg-orange/10'}`}>
                                                <Shield size={20} className={selectedInsuranceId === ins.id ? 'text-white' : 'text-orange'} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <div className="font-syne font-bold text-[14px] text-navy">{ins.name}</div>
                                                    {selectedInsuranceId === ins.id && (
                                                        <div className="w-5 h-5 bg-orange rounded-full flex items-center justify-center flex-shrink-0">
                                                            <Check size={11} className="text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                {ins.feedescription && (
                                                    <div className="text-[12.5px] text-muted mt-0.5 leading-relaxed">{ins.feedescription}</div>
                                                )}
                                                <div className="text-[12px] font-semibold mt-1.5 text-orange">
                                                    {ins.fees === 0 ? 'Included — no extra charge' : `+$${ins.fees}/day ($${ins.fees * booking.days} total)`}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Optional Extras from RCM */}
                        <div>
                            <h2 className="font-syne font-bold text-navy text-xl mb-3">Optional Extras</h2>
                            {loading ? (
                                <div className="flex flex-col gap-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="bg-white border border-black/10 rounded-card h-20 animate-pulse" />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {optionalFees.map(extra => {
                                        const id = String(extra.id)
                                        const qty = extras[id] || 0
                                        const Icon = getIcon(extra.name)
                                        const isDaily = extra.type === 'Daily'
                                        const totalPrice = isDaily
                                            ? extra.maximumprice > 0
                                                ? Math.min(extra.fees * booking.days, extra.maximumprice)
                                                : extra.fees * booking.days
                                            : extra.fees

                                        return (
                                            <div key={extra.id}
                                                 className={`bg-white border rounded-card p-5 flex items-center gap-4 transition-all
                          ${qty > 0 ? 'border-orange/40 shadow-card' : 'border-black/10'}`}>
                                                <div className="w-11 h-11 bg-orange/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <Icon size={20} className="text-orange" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-syne font-bold text-[14px] text-navy">{extra.name}</div>
                                                    {extra.feedescription && (
                                                        <div className="text-[12.5px] text-muted mt-0.5 leading-relaxed">{extra.feedescription}</div>
                                                    )}
                                                    <div className="text-[12px] text-orange font-semibold mt-1">
                                                        +${extra.fees} {isDaily ? 'per day' : 'per rental'}
                                                        {isDaily && booking.days > 0 && (
                                                            <span className="text-muted font-normal ml-1">
                                ({extra.maximumprice > 0 ? `max $${extra.maximumprice}` : `$${totalPrice} total`})
                              </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {extra.qtyapply ? (
                                                        <>
                                                            <button onClick={() => changeExtra(id, -1, 9)}
                                                                    disabled={qty === 0}
                                                                    className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center text-muted hover:border-orange hover:text-orange disabled:opacity-30 transition-all">
                                                                <Minus size={12} />
                                                            </button>
                                                            <span className="w-5 text-center font-syne font-bold text-navy text-sm">{qty}</span>
                                                            <button onClick={() => changeExtra(id, 1, 9)}
                                                                    className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center text-muted hover:border-orange hover:text-orange transition-all">
                                                                <Plus size={12} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => changeExtra(id, qty === 0 ? 1 : -1, 1)}
                                                                className={`px-4 py-1.5 rounded-full text-[12px] font-syne font-bold border transition-all
                                ${qty > 0
                                                                    ? 'bg-orange border-orange text-white'
                                                                    : 'bg-transparent border-black/15 text-muted hover:border-orange hover:text-orange'}`}>
                                                            {qty > 0 ? 'Added ✓' : 'Add'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Order Summary */}
                    <div className="lg:w-72 flex-shrink-0 sticky top-24">
                        <div className="bg-white border border-black/10 rounded-card p-5">
                            <h3 className="font-syne font-bold text-navy text-[15px] mb-4">Order Summary</h3>
                            <div className="space-y-2 text-[13px]">

                                {/* Vehicle */}
                                <div className="flex justify-between items-start gap-2">
                                    <span className="text-navy font-semibold truncate">{booking.vehicleName}</span>
                                    <span className="text-navy font-semibold flex-shrink-0">${vehicleTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-muted text-[12px]">
                                    <span>{booking.days} day{booking.days !== 1 ? 's' : ''} × ${booking.pricePerDay}/day</span>
                                </div>
                                {booking.promoDiscountAmount > 0 && (
                                    <div className="flex justify-between text-green-700 text-[12px]">
                                        <span>Promo {booking.promoCode}</span>
                                        <span>- ${booking.promoDiscountAmount.toLocaleString()}</span>
                                    </div>
                                )}

                                <div className="border-t border-black/[0.07] my-1" />

                                {/* After-hour fees */}
                                {afterHour.pickupFee > 0 && (
                                    <div className="flex justify-between text-muted">
                                        <span>After-hours pickup</span>
                                        <span className="flex-shrink-0">+${afterHour.pickupFee}</span>
                                    </div>
                                )}
                                {afterHour.dropoffFee > 0 && (
                                    <div className="flex justify-between text-muted">
                                        <span>After-hours return</span>
                                        <span className="flex-shrink-0">+${afterHour.dropoffFee}</span>
                                    </div>
                                )}

                                {/* Young Driver */}
                                {isUnder26 && (
                                    <div className="flex justify-between text-muted">
                                        <span>Young Driver Fee</span>
                                        <span className="flex-shrink-0">+${youngDriverTotal}</span>
                                    </div>
                                )}

                                {/* Insurance */}
                                {selectedInsuranceId !== null && (() => {
                                    const ins = booking.insuranceOptions.find(i => i.id === selectedInsuranceId)
                                    if (!ins || ins.fees === 0) return null
                                    return (
                                        <div className="flex justify-between text-muted">
                                            <span className="truncate max-w-[140px]">{ins.name}</span>
                                            <span className="flex-shrink-0">+${insuranceTotal}</span>
                                        </div>
                                    )
                                })()}

                                {/* Optional extras */}
                                {optionalFees.filter(e => (extras[String(e.id)] || 0) > 0).map(e => {
                                    const qty = extras[String(e.id)]
                                    const mult = e.type === 'Daily' ? booking.days : 1
                                    const amount = e.maximumprice > 0
                                        ? Math.min(e.fees * qty * mult, e.maximumprice * qty)
                                        : e.fees * qty * mult
                                    return (
                                        <div key={e.id} className="flex justify-between text-muted">
                                            <span className="truncate max-w-[130px]">{e.name} ×{qty}</span>
                                            <span className="flex-shrink-0">+${amount}</span>
                                        </div>
                                    )
                                })}

                                {/* After-hour explanation note */}
                                {afterHour.total > 0 && (
                                    <div className="text-[11px] text-muted/70 bg-orange/5 border border-orange/15 rounded-lg px-3 py-2 leading-relaxed">
                                        After-hours fee applies for pickups/returns outside 8:30 AM–5:30 PM ($65 each).
                                    </div>
                                )}

                                <div className="border-t border-black/10 pt-3 mt-2 flex justify-between font-syne font-extrabold text-navy text-[16px]">
                                    <span>Total</span>
                                    <span className="text-orange">${grandTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            <button onClick={proceed}
                                    className="w-full mt-5 flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[14px] py-3.5 rounded-xl transition-all">
                                Continue <ArrowRight size={15} />
                            </button>
                            <p className="text-[11px] text-muted text-center mt-3">Free cancellation · No credit card fees</p>
                        </div>
                    </div>
                </div>
            </main>
        </>
    )
}
