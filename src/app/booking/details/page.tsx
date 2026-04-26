'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Mail, Phone, Plane, MessageSquare, ChevronDown } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import BookingFlowHeader from '@/components/booking/BookingFlowHeader'
import Navbar from '@/components/layout/Navbar'
import { useRef } from 'react'

const DIAL_CODES = [
    { key: 'NZ', dial: '+64',  flag: '🇳🇿', name: 'New Zealand' },
    { key: 'AU', dial: '+61',  flag: '🇦🇺', name: 'Australia' },
    { key: 'CN', dial: '+86',  flag: '🇨🇳', name: 'China' },
    { key: 'HK', dial: '+852', flag: '🇭🇰', name: 'Hong Kong' },
    { key: 'TW', dial: '+886', flag: '🇹🇼', name: 'Taiwan' },
    { key: 'SG', dial: '+65',  flag: '🇸🇬', name: 'Singapore' },
    { key: 'JP', dial: '+81',  flag: '🇯🇵', name: 'Japan' },
    { key: 'KR', dial: '+82',  flag: '🇰🇷', name: 'South Korea' },
    { key: 'IN', dial: '+91',  flag: '🇮🇳', name: 'India' },
    { key: 'MY', dial: '+60',  flag: '🇲🇾', name: 'Malaysia' },
    { key: 'ID', dial: '+62',  flag: '🇮🇩', name: 'Indonesia' },
    { key: 'TH', dial: '+66',  flag: '🇹🇭', name: 'Thailand' },
    { key: 'PH', dial: '+63',  flag: '🇵🇭', name: 'Philippines' },
    { key: 'GB', dial: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
    { key: 'US', dial: '+1',   flag: '🇺🇸', name: 'United States' },
    { key: 'CA', dial: '+1',   flag: '🇨🇦', name: 'Canada' },
    { key: 'DE', dial: '+49',  flag: '🇩🇪', name: 'Germany' },
    { key: 'FR', dial: '+33',  flag: '🇫🇷', name: 'France' },
    { key: 'NL', dial: '+31',  flag: '🇳🇱', name: 'Netherlands' },
    { key: 'CH', dial: '+41',  flag: '🇨🇭', name: 'Switzerland' },
    { key: 'IT', dial: '+39',  flag: '🇮🇹', name: 'Italy' },
    { key: 'ES', dial: '+34',  flag: '🇪🇸', name: 'Spain' },
    { key: 'SE', dial: '+46',  flag: '🇸🇪', name: 'Sweden' },
    { key: 'NO', dial: '+47',  flag: '🇳🇴', name: 'Norway' },
    { key: 'DK', dial: '+45',  flag: '🇩🇰', name: 'Denmark' },
    { key: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE' },
    { key: 'ZA', dial: '+27',  flag: '🇿🇦', name: 'South Africa' },
    { key: 'BR', dial: '+55',  flag: '🇧🇷', name: 'Brazil' },
]

function PhoneField({ phone, dialCode, dialKey, onPhoneChange, onDialChange, error }: {
    phone: string
    dialCode: string
    dialKey: string
    onPhoneChange: (val: string) => void
    onDialChange: (key: string, dial: string) => void
    error?: string
}) {
    const selected = DIAL_CODES.find(c => c.key === dialKey) || DIAL_CODES[0]
    return (
        <div>
            <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">
                Phone Number <span className="text-orange">*</span>
            </label>
            <div className={`flex items-stretch bg-off-white border rounded-xl overflow-hidden transition-colors
                ${error ? 'border-red-400' : 'border-black/10 focus-within:border-orange'}`}>
                <div className="relative flex items-center gap-1.5 px-3 border-r border-black/10 flex-shrink-0">
                    <Phone size={14} className="text-muted" />
                    <span className="text-[13px] font-medium text-navy whitespace-nowrap pointer-events-none">
                        {selected.flag} {dialCode}
                    </span>
                    <ChevronDown size={11} className="text-muted pointer-events-none" />
                    <select
                        value={dialKey}
                        onChange={e => {
                            const c = DIAL_CODES.find(x => x.key === e.target.value)
                            if (c) onDialChange(c.key, c.dial)
                        }}
                        className="absolute inset-0 opacity-0 w-full cursor-pointer"
                        aria-label="Country code"
                    >
                        {DIAL_CODES.map(c => (
                            <option key={c.key} value={c.key}>{c.flag} {c.dial} {c.name}</option>
                        ))}
                    </select>
                </div>
                <input
                    type="tel"
                    value={phone}
                    onChange={e => onPhoneChange(e.target.value)}
                    placeholder="21 000 0000"
                    className="bg-transparent flex-1 text-[14px] text-navy outline-none placeholder:text-muted/60 px-4 py-3"
                />
            </div>
            {error && <p className="text-red-500 text-[11px] mt-1">{error}</p>}
        </div>
    )
}

function Field({ label, icon: Icon, value, onChange, error, type = 'text', placeholder, required = false }: {
    label: string
    icon: any
    value: string
    onChange: (val: string) => void
    error?: string
    type?: string
    placeholder?: string
    required?: boolean
}) {
    return (
        <div>
            <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">
                {label} {required && <span className="text-orange">*</span>}
            </label>
            <div className={`flex items-center gap-2.5 bg-off-white border rounded-xl px-4 py-3 transition-colors
        ${error ? 'border-red-400' : 'border-black/10 focus-within:border-orange'}`}>
                <Icon size={14} className="text-muted flex-shrink-0" />
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="bg-transparent flex-1 text-[14px] text-navy outline-none placeholder:text-muted/60"
                />
            </div>
            {error && <p className="text-red-500 text-[11px] mt-1">{error}</p>}
        </div>
    )
}

export default function DetailsPage() {
    const router = useRouter()
    const { booking, setBooking, isHydrated } = useBooking()
    const [form, setForm] = useState({
        firstName: booking.firstName,
        lastName: booking.lastName,
        email: booking.email,
        phone: booking.phone,
        phoneDialCode: booking.phoneDialCode || '+64',
        flightNumber: booking.flightNumber,
        notes: booking.notes,
    })
    const [phoneDialKey, setPhoneDialKey] = useState(() => {
        const dc = booking.phoneDialCode || '+64'
        return DIAL_CODES.find(c => c.dial === dc)?.key || 'NZ'
    })
    const formRef = useRef(form)
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        if (!isHydrated) return
        setForm({
            firstName: booking.firstName,
            lastName: booking.lastName,
            email: booking.email,
            phone: booking.phone,
            phoneDialCode: booking.phoneDialCode || '+64',
            flightNumber: booking.flightNumber,
            notes: booking.notes,
        })
        const dc = booking.phoneDialCode || '+64'
        setPhoneDialKey(DIAL_CODES.find(c => c.dial === dc)?.key || 'NZ')
    }, [booking, isHydrated])
    useEffect(() => {
        formRef.current = form
    }, [form])

    function update(field: string, value: string) {
        setForm(f => ({ ...f, [field]: value }))
        setErrors(e => ({ ...e, [field]: '' }))
    }

    function validate() {
        const e: Record<string, string> = {}
        if (!form.firstName.trim()) e.firstName = 'Required'
        if (!form.lastName.trim()) e.lastName = 'Required'
        if (!form.email.trim()) e.email = 'Required'
        else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
        if (!form.phone.trim()) e.phone = 'Required'
        return e
    }

    async function submit() {
        const latestForm = formRef.current
        const e = validate()
        if (Object.keys(e).length > 0) { setErrors(e); return }

        // Write to sessionStorage synchronously before navigating — React state
        // updates are async and won't flush before router.push() leaves this page,
        // so the payment page would read stale data (missing flightNumber / notes).
        try {
            const raw = sessionStorage.getItem('yitu-booking')
            const current = raw ? JSON.parse(raw) : {}
            sessionStorage.setItem('yitu-booking', JSON.stringify({ ...current, ...latestForm }))
        } catch {}

        setBooking(b => ({ ...b, ...latestForm }))
        router.push(`/booking/payment?total=${grandTotal}&days=${booking.days}&pricePerDay=${booking.pricePerDay}`)
    }

    // Use the full total (vehicle + extras + insurance) saved from the extras page.
    // Fall back to vehicle-only price if somehow totalAmount is missing.
    const baseVehicleTotal = (booking.basePricePerDay || booking.pricePerDay) * booking.days
    const vehicleTotal = Math.max(0, baseVehicleTotal - booking.promoDiscountAmount)
    const grandTotal = booking.totalAmount > 0 ? booking.totalAmount : vehicleTotal

    if (!isHydrated) {
        return (
            <>
                <Navbar onManageBooking={() => {}} />
                <BookingFlowHeader current={4} />
                <main className="max-w-[900px] mx-auto px-10 py-10">
                    <div className="flex flex-col gap-4">
                        <div className="bg-white border border-black/10 rounded-card h-96 animate-pulse" />
                    </div>
                </main>
            </>
        )
    }

    return (
        <>
            <Navbar onManageBooking={() => {}} />

            <BookingFlowHeader current={4} onBack={() => router.back()} />

            <main className="max-w-[900px] mx-auto px-10 py-10">
                <div className="flex gap-8 items-start flex-col lg:flex-row">

                    <div className="flex-1">
                        <h2 className="font-syne font-bold text-navy text-xl mb-6">Your Details</h2>
                        <div className="bg-white border border-black/10 rounded-card p-6 flex flex-col gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="First Name" icon={User} value={form.firstName} onChange={val => update('firstName', val)} error={errors.firstName} placeholder="John" required />
                                <Field label="Last Name" icon={User} value={form.lastName} onChange={val => update('lastName', val)} error={errors.lastName} placeholder="Smith" required />
                            </div>
                            <Field label="Email Address" icon={Mail} type="email" value={form.email} onChange={val => update('email', val)} error={errors.email} placeholder="john@example.com" required />
                            <PhoneField
                                phone={form.phone}
                                dialCode={form.phoneDialCode}
                                dialKey={phoneDialKey}
                                onPhoneChange={val => update('phone', val)}
                                onDialChange={(key, dial) => {
                                    setPhoneDialKey(key)
                                    update('phoneDialCode', dial)
                                }}
                                error={errors.phone}
                            />
                            <Field label="Flight Number" icon={Plane} value={form.flightNumber} onChange={val => update('flightNumber', val)} placeholder="NZ123 (optional)" />
                            <div>
                                <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">Notes</label>
                                <div className="flex items-start gap-2.5 bg-off-white border border-black/10 focus-within:border-orange rounded-xl px-4 py-3 transition-colors">
                                    <MessageSquare size={14} className="text-muted flex-shrink-0 mt-0.5" />
                                    <textarea
                                        value={form.notes}
                                        onChange={e => update('notes', e.target.value)}
                                        placeholder="Any special requests or requirements..."
                                        rows={3}
                                        className="bg-transparent flex-1 text-[14px] text-navy outline-none placeholder:text-muted/60 resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {errors.submit && (
                            <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3 rounded-xl">
                                {errors.submit}
                            </div>
                        )}

                        <p className="text-[12px] text-muted mt-4 leading-relaxed">
                            By completing this booking you agree to YITU&apos;s{' '}
                            <a href="/terms-conditions" target="_blank" className="text-orange hover:underline">Terms &amp; Conditions</a>
                            {' '}and{' '}
                            <a href="/privacy-policy" target="_blank" className="text-orange hover:underline">Privacy Policy</a>.
                        </p>
                    </div>

                    <div className="lg:w-72 flex-shrink-0 sticky top-24">
                        <div className="bg-white border border-black/10 rounded-card p-5">
                            <h3 className="font-syne font-bold text-navy text-[15px] mb-4">Booking Summary</h3>
                            <div className="space-y-2 text-[13px] text-muted mb-4">
                                <div className="flex justify-between">
                                    <span>Vehicle</span>
                                    <span className="text-navy font-medium text-right max-w-[140px]">{booking.vehicleName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Pick-up</span>
                                    <span className="text-navy font-medium">{booking.pickupDate} {booking.pickupTime}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Drop-off</span>
                                    <span className="text-navy font-medium">{booking.dropoffDate} {booking.dropoffTime}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Duration</span>
                                    <span className="text-orange font-semibold">{booking.days} days</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Location</span>
                                    <span className="text-navy font-medium">{booking.pickupLocation}</span>
                                </div>
                            </div>
                            <div className="border-t border-black/10 pt-3 space-y-1.5">
                                {booking.promoDiscountAmount > 0 && (
                                    <>
                                        <div className="flex justify-between text-[12px] text-muted">
                                            <span>Vehicle before promo</span>
                                            <span>${baseVehicleTotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-[12px] text-green-700">
                                            <span>Promo {booking.promoCode}</span>
                                            <span>- ${booking.promoDiscountAmount.toLocaleString()}</span>
                                        </div>
                                    </>
                                )}
                                {grandTotal !== vehicleTotal && (
                                    <div className="flex justify-between text-[12px] text-muted">
                                        <span>Vehicle</span>
                                        <span>${vehicleTotal.toLocaleString()}</span>
                                    </div>
                                )}
                                {grandTotal !== vehicleTotal && (
                                    <div className="flex justify-between text-[12px] text-muted">
                                        <span>Extras &amp; Insurance</span>
                                        <span>+${(grandTotal - vehicleTotal).toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-syne font-extrabold text-navy text-[16px] pt-1">
                                    <span>Total</span>
                                    <span className="text-orange">${grandTotal.toLocaleString()}</span>
                                </div>
                            </div>
                            <button
                                onClick={submit}
                                className="w-full mt-5 flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[15px] py-4 rounded-xl transition-all shadow-orange-glow"
                            >
                                Continue to Payment →
                            </button>
                            <p className="text-[11px] text-muted text-center mt-3">
                                Secured by YITU Car Rental
                            </p>
                        </div>
                    </div>

                </div>
            </main>
        </>
    )
}
