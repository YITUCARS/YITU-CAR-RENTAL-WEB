'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { doc, onSnapshot } from 'firebase/firestore'
import { usePathname } from 'next/navigation'
import { MessageCircle, SendHorizontal, X, Headset, BellDot, Phone, User, ArrowRight, CalendarDays, Car, MapPin, Sparkles, ShieldCheck, AlertCircle, Plus, Minus, Check } from 'lucide-react'
import { Elements } from '@stripe/react-stripe-js'
import type { StripeElementLocale } from '@stripe/stripe-js'
import { ensureAnonymousAuth, getFirebaseFirestore } from '@/lib/firebase'
import {
    ChatFaq, ChatMessage, ChatSession, DEFAULT_FAQS,
    getInitialBotMessage, matchFaqReply,
    getNoMatchReply, getSupportConfirmedReply, getAgentJoinedReply,
    buildTelegramMessage, getChatFaqQuestion,
} from '@/lib/chat'
import { calcAfterHourBreakdown, calcDays, formatAfterHourFeeLabel, splitMandatoryFees } from '@/lib/booking-context'
import StripeCheckout from '@/components/booking/StripeCheckout'
import { getStripe, STRIPE_MODE } from '@/lib/stripe-client'
import enMessages from '../../messages/en.json'
import zhMessages from '../../messages/zh.json'

const STORAGE_KEY = 'yitu-chat-session-id'
const QUICK_FINDER_DISMISSED_KEY = 'yitu-chat-quick-finder-dismissed'
const PAGE_HINT_DISMISSED_KEY = 'yitu-chat-page-hint-disabled'
const CHAT_WIDGET_POSITION_KEY = 'yitu-chat-widget-position'
const BOOKING_STORAGE_KEY = 'yitu-booking'
const CHAT_LANGUAGE_KEY = 'yitu-chat-language'
const stripePromise = getStripe()
// After this many unanswered questions, proactively suggest human support
const UNANSWERED_THRESHOLD = 2
const YOUNG_DRIVER_FEE_ID = 15
const YOUNG_DRIVER_FEE_PER_DAY = 30

type ChatLocale = 'en' | 'zh'

type BookingPageContext = {
    hint: string
    title: string
    faqs: ChatFaq[]
}

function getBookingPageContext(pathname: string, locale: ChatLocale): BookingPageContext {
    const zh = locale === 'zh'
    const makeFaq = (question: string, answer: string, displayOrder: number): ChatFaq => ({
        question,
        answer,
        keywords: [question],
        active: true,
        displayOrder,
    })

    if (pathname.includes('/booking/payment')) {
        return {
            hint: zh ? '对费用或付款比例有疑问？' : 'Questions about the total or payment?',
            title: zh ? '付款页面帮助' : 'Payment page help',
            faqs: [
                makeFaq(
                    zh ? '总价里包含哪些费用？' : 'What is included in the booking total?',
                    zh ? '总价会根据你的车辆、租期、保险、附加项以及适用的强制费用计算。付款前会在费用明细中显示各项金额。' : 'The total can include the vehicle, rental days, insurance, optional extras, and any applicable mandatory fees. The breakdown is shown before you pay.',
                    1,
                ),
                makeFaq(
                    zh ? '可以支付定金还是全款？' : 'Can I pay a deposit or the full amount?',
                    zh ? '如果订单支持分期付款，你可以在付款页面选择定金或全款。页面会清楚显示本次需要支付的金额，以及剩余金额的说明。' : 'If your booking supports split payment, you can choose the deposit or the full amount on this page. The amount due now and any balance are shown clearly before checkout.',
                    2,
                ),
                makeFaq(
                    zh ? '为什么付款金额和车辆页面不同？' : 'Why is the payment amount different from the vehicle page?',
                    zh ? '付款页会加入你在后续步骤选择的保险、附加项、异地还车费和营业时间外服务费，因此最终金额可能与最初的车辆价格不同。' : 'The payment page includes choices made later, such as insurance, extras, one-way fees, and after-hours service fees, so it can differ from the initial vehicle price.',
                    3,
                ),
            ],
        }
    }

    if (pathname.includes('/booking/details')) {
        return {
            hint: zh ? '填写资料时需要帮助吗？' : 'Need help completing your details?',
            title: zh ? '驾驶员资料帮助' : 'Driver details help',
            faqs: [
                makeFaq(
                    zh ? '这里需要填写哪些资料？' : 'What details do I need to provide?',
                    zh ? '请填写主要驾驶员的姓名、邮箱和电话。我们会用这些资料发送预订确认和重要的取还车信息。' : 'Please provide the main driver\'s name, email, and phone number. We use these details to send your booking confirmation and important pickup information.',
                    1,
                ),
                makeFaq(
                    zh ? 'Flight number 是必须填写的吗？' : 'Is the flight number required?',
                    zh ? 'Flight number 通常是可选的。如果你乘坐航班到达，填写它可以帮助我们更好地安排取车沟通。' : 'The flight number is usually optional. If you are arriving by air, adding it can help us coordinate your pickup more smoothly.',
                    2,
                ),
                makeFaq(
                    zh ? '资料填写后还可以修改吗？' : 'Can I change my details later?',
                    zh ? '提交订单前可以返回修改。订单提交后如需更改，请通过聊天联系团队，我们会协助你处理。' : 'You can go back and edit your details before submitting the booking. After submission, contact our team through chat and we will help.',
                    3,
                ),
            ],
        }
    }

    if (pathname.includes('/booking/extras')) {
        return {
            hint: zh ? '对保险或附加项有疑问？' : 'Questions about insurance or extras?',
            title: zh ? '保险和附加项帮助' : 'Insurance and extras help',
            faqs: [
                makeFaq(
                    zh ? '保险选项有什么区别？' : 'What is the difference between the insurance options?',
                    zh ? '基础保险包含标准保障，其他保险选项可以降低你的责任金额或提供更全面的保障。每个选项的费用和说明都会显示在本页。' : 'Basic cover provides standard protection. Other options can reduce your excess or provide broader protection. The price and description for each option are shown here.',
                    1,
                ),
                makeFaq(
                    zh ? '附加项是按天收费还是按订单收费？' : 'Are extras charged per day or per rental?',
                    zh ? '不同附加项的计费方式不同。页面会标明是每天收费还是整笔订单收费，并显示预计总额。' : 'It depends on the extra. This page shows whether each item is charged per day or per rental, along with the estimated total.',
                    2,
                ),
                makeFaq(
                    zh ? '儿童座椅可以选择哪些类型？' : 'Which child seats can I add?',
                    zh ? '根据儿童年龄和身高，你可以选择婴儿座椅、儿童座椅或增高座椅。库存有限，建议在这里提前添加。' : 'Depending on the child\'s age and size, you can choose an infant seat, baby seat, or booster seat. Availability is limited, so we recommend adding one here in advance.',
                    3,
                ),
            ],
        }
    }

    if (pathname.includes('/booking/vehicles')) {
        return {
            hint: zh ? '找车或价格有疑问？' : 'Need help choosing a vehicle?',
            title: zh ? '车辆选择帮助' : 'Vehicle selection help',
            faqs: [
                makeFaq(
                    zh ? '为什么修改筛选后要点击 Update Results？' : 'Why do I need to click Update Results after changing filters?',
                    zh ? '左侧筛选条件修改后，点击 Update Results 才会重新查询车辆和价格。未点击前，页面仍会保留上一次搜索结果。' : 'After changing the filters, click Update Results to search again and recalculate availability and pricing. Until then, the previous results remain active.',
                    1,
                ),
                makeFaq(
                    zh ? '车辆价格为什么会变化？' : 'Why can the vehicle price change?',
                    zh ? '价格会根据租车日期、租期、取还车地点、驾驶员年龄、优惠码和车辆库存计算。最终价格会在预订流程中确认。' : 'Pricing depends on your dates, rental length, locations, driver age, promo code, and live availability. The final price is confirmed during the booking flow.',
                    2,
                ),
                makeFaq(
                    zh ? '可以异地还车吗？' : 'Can I return the car in another location?',
                    zh ? '部分地点支持异地还车。如果适用，页面会显示异地还车费用；不可用的路线不会出现在可预订结果中。' : 'Some locations support one-way rentals. If available, the relocation fee is shown during booking; unavailable routes will not be offered as bookable results.',
                    3,
                ),
            ],
        }
    }

    return {
        hint: zh ? '需要了解租车信息吗？' : 'Need help with your rental?',
        title: zh ? '租车帮助' : 'Rental help',
        faqs: [],
    }
}

const DIAL_CODES = [
    { key: 'NZ', dial: '+64', label: 'NZ +64' },
    { key: 'CN', dial: '+86', label: 'CN +86' },
    { key: 'AU', dial: '+61', label: 'AU +61' },
    { key: 'US', dial: '+1', label: 'US +1' },
    { key: 'GB', dial: '+44', label: 'GB +44' },
    { key: 'SG', dial: '+65', label: 'SG +65' },
]

type QuickFinderState = {
    pickupLocation: string
    dropoffLocation: string
    pickupDate: string
    dropoffDate: string
    adults: number
    children: number
    largeBags: number
    smallBags: number
    childSeat: boolean
    promoCode: string
}

type FeaturedVehicle = {
    vehiclecategoryid?: number
    vehiclecategorytypeid?: number
    vehiclecategory?: string
    categoryfriendlydescription?: string
    imageurl?: string
    image_url?: string
    image?: string
    vehicleimageurl?: string
    avgrate?: number
    totalratebeforediscount?: number
    totalrateafterdiscount?: number
    totaldiscountamount?: number
    numberofadults?: number
    numberoflargecases?: number
    numberofsmallcases?: number
    available?: number
    availablemessage?: string
    slot?: number
}

type ChatBookingState = {
    vehicle: FeaturedVehicle
    days: number
    basePricePerDay: number
    pricePerDay: number
    promoDiscountAmount: number
    insuranceOptions: any[]
    optionalFees: any[]
    mandatoryFees: any[]
    selectedInsuranceId: number | null
    extras: Record<string, number>
    loading: boolean
    error?: string
}

const CHAT_COPY = {
    en: enMessages.ChatWidget,
    zh: zhMessages.ChatWidget,
} as const

function createSessionId() {
    return crypto.randomUUID()
}

function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString('en-NZ', {
        hour: 'numeric',
        minute: '2-digit',
    })
}

function playNotificationSound() {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.value = 0.03
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.12)
}

function sortMessages(messages: ChatMessage[]) {
    return [...messages].sort((a, b) => a.timestamp - b.timestamp)
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
    const map = new Map<string, ChatMessage>()
    for (const msg of [...current, ...incoming]) {
        map.set(`${msg.sender}-${msg.timestamp}-${msg.text}`, msg)
    }
    return sortMessages(Array.from(map.values()))
}

function getDefaultFinderDates() {
    const pickup = new Date()
    pickup.setDate(pickup.getDate() + 3)
    const dropoff = new Date(pickup)
    dropoff.setDate(dropoff.getDate() + 4)
    return {
        pickupDate: pickup.toISOString().slice(0, 10),
        dropoffDate: dropoff.toISOString().slice(0, 10),
    }
}

function locationId(location: string) {
    if (location === 'Queenstown') return 7
    return 1
}

function passengerCount(finder: QuickFinderState) {
    return Math.max(1, Number(finder.adults || 0) + Number(finder.children || 0))
}

function vehicleMatchesFinder(vehicle: FeaturedVehicle, finder: QuickFinderState) {
    const seats = Number(vehicle.numberofadults || 0)
    const large = Number(vehicle.numberoflargecases || 0)
    const small = Number(vehicle.numberofsmallcases || 0)
    const hasCapacity = seats <= 0 || seats >= passengerCount(finder)
    const hasLargeBags = large <= 0 || large >= Number(finder.largeBags || 0)
    const hasSmallBags = small <= 0 || small >= Number(finder.smallBags || 0)
    return hasCapacity && hasLargeBags && hasSmallBags
}

function sortVehiclesForFinder(vehicles: FeaturedVehicle[], finder: QuickFinderState) {
    return [...vehicles]
        .filter(vehicle => vehicle.available !== 0)
        .filter(vehicle => vehicleMatchesFinder(vehicle, finder))
        .sort((a, b) => {
            const aSeats = Number(a.numberofadults || 99)
            const bSeats = Number(b.numberofadults || 99)
            const aPrice = Number(a.avgrate || a.totalrateafterdiscount || 999999)
            const bPrice = Number(b.avgrate || b.totalrateafterdiscount || 999999)
            return (aSeats - bSeats) || (aPrice - bPrice)
        })
}

function getVehicleImageUrl(vehicle: FeaturedVehicle) {
    const raw = vehicle.imageurl || vehicle.image_url || vehicle.vehicleimageurl || vehicle.image || ''
    if (!raw) return ''
    if (raw.startsWith('//')) return `https:${raw}`
    if (raw.startsWith('http://rentalcarmanagerau.blob.core.windows.net')) {
        return raw.replace('http://', 'https://')
    }
    return raw
}

function roundMoney(value: number) {
    return Math.round(value * 100) / 100
}

function isRecommendedVehicleSelectable(vehicle: FeaturedVehicle) {
    const status = (vehicle.availablemessage || '').trim().toLowerCase()
    const hasVehicleIds = Boolean(vehicle.vehiclecategoryid && vehicle.vehiclecategorytypeid)
    const hasPrice = Number(vehicle.avgrate || vehicle.totalrateafterdiscount || 0) > 0
    return hasVehicleIds && hasPrice && (status === 'available' || vehicle.available === 1 || !status)
}

function getRecommendedVehiclePricing(vehicle: FeaturedVehicle, days: number) {
    const safeDays = Math.max(days, 1)
    const baseRatePerDay = roundMoney(Number(vehicle.avgrate || 0))
    const baseTotal = roundMoney(baseRatePerDay * safeDays)

    let promoDiscount = 0
    const totalDiscountAmount = Number(vehicle.totaldiscountamount || 0)
    const totalAfterDiscount = Number(vehicle.totalrateafterdiscount || 0)
    if (totalDiscountAmount > 0) {
        promoDiscount = roundMoney(totalDiscountAmount)
    } else if (totalAfterDiscount > 0 && totalAfterDiscount < baseTotal) {
        promoDiscount = roundMoney(baseTotal - totalAfterDiscount)
    }

    const discountedTotal = roundMoney(Math.max(0, baseTotal - promoDiscount))
    const effectivePerDay = roundMoney(discountedTotal / safeDays)
    return { promoDiscount, effectivePerDay }
}

function calculateExtraTotal(extra: any, qty: number, days: number) {
    if (!qty) return 0
    const multiplier = extra.type === 'Daily' ? days : 1
    return extra.maximumprice > 0
        ? Math.min(extra.fees * qty * multiplier, extra.maximumprice * qty)
        : extra.fees * qty * multiplier
}

function calculateChatBookingTotals(state: ChatBookingState, driverAge: string, pickupTime: string, dropoffTime: string) {
    const baseVehicleTotal = roundMoney(state.basePricePerDay * state.days)
    const vehicleTotal = Math.max(0, roundMoney(baseVehicleTotal - state.promoDiscountAmount))
    const selectedInsurance = state.insuranceOptions.find((item: any) => item.id === state.selectedInsuranceId)
    const insuranceTotal = selectedInsurance?.fees ? selectedInsurance.fees * state.days : 0
    const extrasTotal = state.optionalFees.reduce((sum: number, extra: any) => {
        return sum + calculateExtraTotal(extra, state.extras[String(extra.id)] || 0, state.days)
    }, 0)
    const { afterHourFees, otherFees } = splitMandatoryFees(state.mandatoryFees)
    const calculatedAfterHour = calcAfterHourBreakdown(pickupTime, dropoffTime)
    const afterHourTotal = afterHourFees.length > 0
        ? afterHourFees.reduce((sum: number, fee: any) => sum + (fee.fees || 0), 0)
        : calculatedAfterHour.total
    const relocationTotal = otherFees.reduce((sum: number, fee: any) => sum + (fee.fees || 0), 0)
    const youngDriverTotal = driverAge === 'under26' ? YOUNG_DRIVER_FEE_PER_DAY * state.days : 0
    const grandTotal = vehicleTotal + insuranceTotal + extrasTotal + afterHourTotal + relocationTotal + youngDriverTotal

    return {
        baseVehicleTotal,
        vehicleTotal,
        selectedInsurance,
        insuranceTotal,
        extrasTotal,
        afterHourFees,
        otherFees,
        calculatedAfterHour,
        afterHourTotal,
        relocationTotal,
        youngDriverTotal,
        grandTotal,
    }
}

function detectChatLocale(): ChatLocale {
    if (typeof window === 'undefined') return 'en'
    const saved = window.localStorage.getItem(CHAT_LANGUAGE_KEY)
    if (saved === 'zh' || saved === 'en') return saved
    const browserLanguage = `${navigator.language} ${navigator.languages?.join(' ') || ''}`.toLowerCase()
    if (window.location.pathname.startsWith('/zh') || browserLanguage.includes('zh')) return 'zh'
    return 'en'
}

// ── Contact collection form ───────────────────────────────────────────────────

function ContactForm({ onSubmit, onCancel, sending, locale }: {
    onSubmit: (name: string, phone: string) => void
    onCancel: () => void
    sending: boolean
    locale: ChatLocale
}) {
    const copy = CHAT_COPY[locale]
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})

    function validate() {
        const e: { name?: string; phone?: string } = {}
        if (!name.trim()) e.name = copy.requiredName
        if (!phone.trim()) e.phone = copy.requiredPhone
        return e
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const errs = validate()
        if (Object.keys(errs).length > 0) { setErrors(errs); return }
        onSubmit(name.trim(), phone.trim())
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-orange/25 bg-orange/5 p-4 mt-2">
            <p className="text-[12.5px] text-navy font-semibold mb-3">
                {copy.contactBody}
            </p>

            <div className="flex flex-col gap-2.5">
                <div>
                    <div className={`flex items-center gap-2 bg-white border rounded-xl px-3 py-2 ${errors.name ? 'border-red-400' : 'border-black/10 focus-within:border-orange'}`}>
                        <User size={13} className="text-muted flex-shrink-0" />
                        <input
                            type="text"
                            value={name}
                            onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: '' })) }}
                            placeholder={copy.namePlaceholder}
                            className="flex-1 bg-transparent text-[13px] text-navy outline-none placeholder:text-muted/60"
                        />
                    </div>
                    {errors.name && <p className="text-[11px] text-red-500 mt-0.5 pl-1">{errors.name}</p>}
                </div>

                <div>
                    <div className={`flex items-center gap-2 bg-white border rounded-xl px-3 py-2 ${errors.phone ? 'border-red-400' : 'border-black/10 focus-within:border-orange'}`}>
                        <Phone size={13} className="text-muted flex-shrink-0" />
                        <input
                            type="tel"
                            value={phone}
                            onChange={e => { setPhone(e.target.value); setErrors(v => ({ ...v, phone: '' })) }}
                            placeholder={copy.phonePlaceholder}
                            className="flex-1 bg-transparent text-[13px] text-navy outline-none placeholder:text-muted/60"
                        />
                    </div>
                    {errors.phone && <p className="text-[11px] text-red-500 mt-0.5 pl-1">{errors.phone}</p>}
                </div>
            </div>

            <div className="flex gap-2 mt-3">
                <button
                    type="submit"
                    disabled={sending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-navy text-white rounded-xl py-2 text-[12px] font-bold transition-colors hover:bg-navy/90 disabled:opacity-60"
                >
                    {sending ? copy.sending : <><ArrowRight size={13} /> {copy.sendSupport}</>}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-3 py-2 rounded-xl border border-black/10 text-[12px] text-muted hover:border-orange hover:text-orange transition-colors"
                >
                    {copy.cancel}
                </button>
            </div>
        </form>
    )
}

function LanguageChoiceCard({ locale, onChoose }: {
    locale: ChatLocale
    onChoose: (locale: ChatLocale) => void
}) {
    const copy = CHAT_COPY[locale]
    return (
        <div className="mb-4 rounded-[24px] border border-orange/25 bg-white p-4 shadow-sm">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-orange/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
                <Sparkles size={12} /> {copy.languageLabel}
            </div>
            <h4 className="font-syne text-[16px] font-extrabold text-navy">{copy.languageTitle}</h4>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{copy.languageBody}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => onChoose('zh')}
                    className={`rounded-2xl border px-3 py-3 text-left transition-all ${locale === 'zh' ? 'border-orange bg-orange text-white' : 'border-black/10 bg-off-white text-navy hover:border-orange/30'}`}
                >
                    <div className="font-syne text-[14px] font-extrabold">中文</div>
                    <div className={`text-[11px] ${locale === 'zh' ? 'text-white/80' : 'text-muted'}`}>Chinese</div>
                </button>
                <button
                    type="button"
                    onClick={() => onChoose('en')}
                    className={`rounded-2xl border px-3 py-3 text-left transition-all ${locale === 'en' ? 'border-orange bg-orange text-white' : 'border-black/10 bg-off-white text-navy hover:border-orange/30'}`}
                >
                    <div className="font-syne text-[14px] font-extrabold">English</div>
                    <div className={`text-[11px] ${locale === 'en' ? 'text-white/80' : 'text-muted'}`}>英文</div>
                </button>
            </div>
        </div>
    )
}

function QuickFinderForm({ value, onChange, onSubmit, onDismiss, sending, locale }: {
    value: QuickFinderState
    onChange: (updates: Partial<QuickFinderState>) => void
    onSubmit: () => void
    onDismiss: () => void
    sending: boolean
    locale: ChatLocale
}) {
    const [dateError, setDateError] = useState('')
    const copy = CHAT_COPY[locale]

    function submit(e: React.FormEvent) {
        e.preventDefault()
        if (!value.pickupDate || !value.dropoffDate || value.dropoffDate <= value.pickupDate) {
            setDateError(copy.invalidDates)
            return
        }
        setDateError('')
        onSubmit()
    }

    return (
        <form onSubmit={submit} className="mb-4 rounded-[24px] border border-orange/20 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-orange/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
                        <Sparkles size={12} /> {copy.quickFinder}
                    </div>
                    <h4 className="mt-2 font-syne text-[16px] font-extrabold text-navy">{copy.quickFinderTitle}</h4>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">
                        {copy.quickFinderBody}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="rounded-full border border-black/10 p-1.5 text-muted transition-colors hover:border-orange hover:text-orange"
                    aria-label="Close quick finder"
                >
                    <X size={14} />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
                <label>
                    <span className="mb-1 flex items-center gap-1 text-[11px] font-bold text-muted">
                        <MapPin size={11} /> {copy.pickUp}
                    </span>
                    <select
                        value={value.pickupLocation}
                        onChange={e => onChange({ pickupLocation: e.target.value, dropoffLocation: e.target.value })}
                        className="w-full rounded-xl border border-black/10 bg-off-white px-3 py-2.5 text-[12.5px] text-navy outline-none focus:border-orange"
                    >
                        <option value="Christchurch">Christchurch</option>
                        <option value="Queenstown">Queenstown</option>
                    </select>
                </label>

                <label>
                    <span className="mb-1 flex items-center gap-1 text-[11px] font-bold text-muted">
                        <MapPin size={11} /> {copy.returnLocation}
                    </span>
                    <select
                        value={value.dropoffLocation}
                        onChange={e => onChange({ dropoffLocation: e.target.value })}
                        className="w-full rounded-xl border border-black/10 bg-off-white px-3 py-2.5 text-[12.5px] text-navy outline-none focus:border-orange"
                    >
                        <option value="Christchurch">Christchurch</option>
                        <option value="Queenstown">Queenstown</option>
                    </select>
                </label>

                <label>
                    <span className="mb-1 flex items-center gap-1 text-[11px] font-bold text-muted">
                        <CalendarDays size={11} /> {copy.pickUpDate}
                    </span>
                    <input
                        type="date"
                        value={value.pickupDate}
                        onChange={e => onChange({ pickupDate: e.target.value })}
                        className="w-full rounded-xl border border-black/10 bg-off-white px-3 py-2.5 text-[12.5px] text-navy outline-none focus:border-orange"
                    />
                </label>

                <label>
                    <span className="mb-1 flex items-center gap-1 text-[11px] font-bold text-muted">
                        <CalendarDays size={11} /> {copy.returnDate}
                    </span>
                    <input
                        type="date"
                        value={value.dropoffDate}
                        onChange={e => onChange({ dropoffDate: e.target.value })}
                        className="w-full rounded-xl border border-black/10 bg-off-white px-3 py-2.5 text-[12.5px] text-navy outline-none focus:border-orange"
                    />
                </label>

                <label className="col-span-2">
                    <span className="mb-1 flex items-center gap-1 text-[11px] font-bold text-muted">
                        <User size={11} /> {copy.travellers}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={value.adults}
                            onChange={e => onChange({ adults: Number(e.target.value) })}
                            className="w-full rounded-xl border border-black/10 bg-off-white px-3 py-2.5 text-[12.5px] text-navy outline-none focus:border-orange"
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(count => (
                                <option key={count} value={count}>{count} {copy.adults}{count > 1 ? copy.adultsPlural : ''}</option>
                            ))}
                        </select>
                        <select
                            value={value.children}
                            onChange={e => onChange({ children: Number(e.target.value), childSeat: Number(e.target.value) > 0 ? value.childSeat : false })}
                            className="w-full rounded-xl border border-black/10 bg-off-white px-3 py-2.5 text-[12.5px] text-navy outline-none focus:border-orange"
                        >
                            {[0, 1, 2, 3, 4].map(count => (
                                <option key={count} value={count}>{count} {copy.children}{count !== 1 ? copy.childrenPlural : ''}</option>
                            ))}
                        </select>
                    </div>
                </label>

                <label className="col-span-2">
                    <span className="mb-1 flex items-center gap-1 text-[11px] font-bold text-muted">
                        <Car size={11} /> {copy.luggage}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={value.largeBags}
                            onChange={e => onChange({ largeBags: Number(e.target.value) })}
                            className="w-full rounded-xl border border-black/10 bg-off-white px-3 py-2.5 text-[12.5px] text-navy outline-none focus:border-orange"
                        >
                            {[0, 1, 2, 3, 4, 5].map(count => (
                                <option key={count} value={count}>{count} {copy.largeBag}{count !== 1 ? copy.largeBagPlural : ''}</option>
                            ))}
                        </select>
                        <select
                            value={value.smallBags}
                            onChange={e => onChange({ smallBags: Number(e.target.value) })}
                            className="w-full rounded-xl border border-black/10 bg-off-white px-3 py-2.5 text-[12.5px] text-navy outline-none focus:border-orange"
                        >
                            {[0, 1, 2, 3, 4, 5].map(count => (
                                <option key={count} value={count}>{count} {copy.smallBag}{count !== 1 ? copy.smallBagPlural : ''}</option>
                            ))}
                        </select>
                    </div>
                </label>

                {value.children > 0 && (
                    <label className="col-span-2 flex items-center justify-between gap-3 rounded-xl border border-orange/15 bg-orange/5 px-3 py-2.5">
                        <span className="text-[12.5px] font-semibold text-navy">{copy.childSeat}</span>
                        <button
                            type="button"
                            onClick={() => onChange({ childSeat: !value.childSeat })}
                            className={`relative h-6 w-11 rounded-full transition-colors ${value.childSeat ? 'bg-orange' : 'bg-black/20'}`}
                            aria-pressed={value.childSeat}
                        >
                            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${value.childSeat ? 'left-6' : 'left-1'}`} />
                        </button>
                    </label>
                )}

                <label className="col-span-2">
                    <span className="mb-1 block text-[11px] font-bold text-muted">
                        {locale === 'zh' ? '优惠码（可选）' : 'Promo code (optional)'}
                    </span>
                    <input
                        type="text"
                        value={value.promoCode}
                        onChange={e => onChange({ promoCode: e.target.value.toUpperCase() })}
                        placeholder={locale === 'zh' ? '如果有优惠码，请输入' : 'Enter a promo code if you have one'}
                        className="w-full rounded-xl border border-black/10 bg-off-white px-3 py-2.5 text-[12.5px] uppercase text-navy outline-none focus:border-orange"
                        maxLength={32}
                    />
                </label>
            </div>

            {dateError && <p className="mt-2 text-[11px] text-red-500">{dateError}</p>}

            <button
                type="submit"
                disabled={sending}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-orange py-3 text-[13px] font-bold text-white shadow-[0_12px_26px_rgba(232,67,26,0.22)] transition-colors hover:bg-orange-dark disabled:opacity-60"
            >
                {sending ? copy.findingCars : <><Sparkles size={14} /> {copy.showOptions}</>}
            </button>
        </form>
    )
}

function VehicleRecommendations({ vehicles, onSearch, onSelect, source, locale }: {
    vehicles: FeaturedVehicle[]
    onSearch: () => void
    onSelect: (vehicle: FeaturedVehicle) => void
    source: 'live' | 'featured' | 'none'
    locale: ChatLocale
}) {
    const visible = vehicles.slice(0, 3)
    const copy = CHAT_COPY[locale]

    return (
        <div className="mb-4 rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
                        {source === 'live' ? copy.liveMatches : copy.quickPicks}
                    </div>
                    <h4 className="font-syne text-[15px] font-extrabold text-navy">{copy.recommended}</h4>
                    <p className="mt-0.5 text-[11.5px] text-muted">{copy.recommendedHint}</p>
                </div>
                <button
                    type="button"
                    onClick={onSearch}
                    className="rounded-full bg-navy px-3 py-1.5 text-[11.5px] font-bold text-white transition-colors hover:bg-navy/90"
                >
                    {copy.viewAll}
                </button>
            </div>

            {visible.length > 0 ? (
                <div className="space-y-2">
                    {visible.map((vehicle, index) => {
                        const imageUrl = getVehicleImageUrl(vehicle)
                        return (
                        <button
                            type="button"
                            key={`${vehicle.vehiclecategory || 'vehicle'}-${index}`}
                            onClick={() => onSelect(vehicle)}
                            className="flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-off-white/70 p-2.5 text-left transition-colors hover:border-orange/40 hover:bg-orange/5"
                        >
                            <div className="h-14 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-white">
                                {imageUrl ? (
                                    <img src={imageUrl} alt={vehicle.vehiclecategory || 'Vehicle'} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-muted">
                                        <Car size={18} />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-syne text-[13px] font-bold text-navy">
                                    {vehicle.vehiclecategory || 'Available vehicle'}
                                </div>
                                <div className="mt-0.5 line-clamp-1 text-[11.5px] text-muted">
                                    {vehicle.categoryfriendlydescription || 'Ready for your New Zealand trip'}
                                </div>
                                <div className="mt-1 text-[11px] font-semibold text-orange">
                                    {vehicle.numberofadults ? `${vehicle.numberofadults} ${copy.seats}` : copy.quickFinder}
                                    {vehicle.numberoflargecases || vehicle.numberofsmallcases
                                        ? ` · ${vehicle.numberoflargecases || 0}L + ${vehicle.numberofsmallcases || 0}S ${copy.bags}`
                                        : ''}
                                </div>
                                <div className="mt-0.5 text-[11px] font-bold text-navy">
                                    {vehicle.avgrate ? `$${Number(vehicle.avgrate).toFixed(0)}${copy.perDay}` : ''}
                                    {vehicle.totalrateafterdiscount ? ` · $${Number(vehicle.totalrateafterdiscount).toFixed(0)} ${copy.totalSuffix}` : ''}
                                </div>
                                <div className="mt-1 text-[11px] font-bold text-navy underline decoration-orange/40 underline-offset-2">
                                    {copy.bookThisCar}
                                </div>
                            </div>
                        </button>
                        )
                    })}
                </div>
            ) : (
                <p className="rounded-2xl bg-off-white px-3 py-3 text-[12.5px] text-muted">
                    {copy.noQuickMatch}
                </p>
            )}
        </div>
    )
}

function ChatBookingPanel({ state, locale, driverAge, pickupTime, dropoffTime, onChange, onContinue, onViewAll }: {
    state: ChatBookingState
    locale: ChatLocale
    driverAge: string
    pickupTime: string
    dropoffTime: string
    onChange: (updates: Partial<ChatBookingState>) => void
    onContinue: () => void
    onViewAll: () => void
}) {
    const copy = CHAT_COPY[locale]
    const totals = calculateChatBookingTotals(state, driverAge, pickupTime, dropoffTime)
    const requiredFees = [
        ...totals.afterHourFees.map((fee: any) => ({
            id: `mandatory-${fee.id}`,
            name: formatAfterHourFeeLabel(fee),
            amount: fee.fees || 0,
            reason: copy.afterHourReason,
        })),
        ...(!totals.afterHourFees.length && totals.calculatedAfterHour.pickupFee > 0 ? [{
            id: 'after-pickup',
            name: locale === 'zh' ? '非营业时间取车' : 'After-hours pickup',
            amount: totals.calculatedAfterHour.pickupFee,
            reason: copy.afterHourReason,
        }] : []),
        ...(!totals.afterHourFees.length && totals.calculatedAfterHour.dropoffFee > 0 ? [{
            id: 'after-dropoff',
            name: locale === 'zh' ? '非营业时间还车' : 'After-hours return',
            amount: totals.calculatedAfterHour.dropoffFee,
            reason: copy.afterHourReason,
        }] : []),
        ...totals.otherFees.map((fee: any) => ({
            id: `relocation-${fee.id}`,
            name: fee.name || (locale === 'zh' ? '异地还车费用' : 'One-way relocation fee'),
            amount: fee.fees || 0,
            reason: copy.relocationReason,
        })),
        ...(driverAge === 'under26' ? [{
            id: 'young-driver',
            name: copy.youngDriverFee,
            amount: totals.youngDriverTotal,
            reason: copy.youngDriverReason,
        }] : []),
    ]

    function updateExtra(extra: any, delta: number, max: number) {
        const id = String(extra.id)
        const current = state.extras[id] || 0
        const next = Math.min(max, Math.max(0, current + delta))
        onChange({ extras: { ...state.extras, [id]: next } })
    }

    if (state.loading) {
        return (
            <div className="mb-4 rounded-[24px] border border-orange/20 bg-white p-4 shadow-sm">
                <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
                <div className="mt-3 h-24 animate-pulse rounded-2xl bg-gray-100" />
                <p className="mt-3 text-[12px] text-muted">{copy.loadingOptions}</p>
            </div>
        )
    }

    return (
        <div className="mb-4 space-y-3 rounded-[24px] border border-orange/20 bg-white p-4 shadow-sm">
            <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange">{copy.bookingTitle}</div>
                <h4 className="font-syne text-[15px] font-extrabold text-navy">{state.vehicle.categoryfriendlydescription || state.vehicle.vehiclecategory}</h4>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">{copy.bookingHint}</p>
            </div>

            <div className="rounded-2xl border border-orange/20 bg-orange/5 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-navy">
                    <AlertCircle size={14} className="text-orange" /> {copy.requiredFees}
                </div>
                {requiredFees.length > 0 ? (
                    <div className="space-y-2">
                        {requiredFees.map(fee => (
                            <div key={fee.id} className="rounded-xl bg-white px-3 py-2">
                                <div className="flex justify-between gap-2 text-[12px] font-bold text-navy">
                                    <span>{fee.name}</span>
                                    <span>+${fee.amount}</span>
                                </div>
                                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{fee.reason}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[12px] text-muted">{copy.noRequiredFees}</p>
                )}
            </div>

            {state.insuranceOptions.length > 0 && (
                <div>
                    <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-navy">
                        <ShieldCheck size={14} className="text-orange" /> {copy.insurance}
                    </div>
                    <div className="space-y-2">
                        {state.insuranceOptions.map((insurance: any) => (
                            <button
                                key={insurance.id}
                                type="button"
                                onClick={() => onChange({ selectedInsuranceId: insurance.id })}
                                className={`w-full rounded-2xl border px-3 py-2.5 text-left transition-all ${state.selectedInsuranceId === insurance.id ? 'border-orange bg-orange/5' : 'border-black/10 bg-off-white/60 hover:border-orange/30'}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-syne text-[12.5px] font-bold text-navy">{insurance.name}</div>
                                        {insurance.feedescription && <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted">{insurance.feedescription}</p>}
                                        <div className="mt-1 text-[11px] font-semibold text-orange">
                                            {insurance.fees === 0 ? copy.included : `+$${insurance.fees}${copy.perDay} · $${insurance.fees * state.days} ${copy.total}`}
                                        </div>
                                    </div>
                                    {state.selectedInsuranceId === insurance.id && <Check size={16} className="mt-0.5 flex-shrink-0 text-orange" />}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <div className="mb-2 text-[12px] font-bold text-navy">{copy.optionalExtras}</div>
                <div className="space-y-2">
                    {state.optionalFees.length > 0 ? state.optionalFees.map((extra: any) => {
                        const id = String(extra.id)
                        const qty = state.extras[id] || 0
                        const isDaily = extra.type === 'Daily'
                        const amount = calculateExtraTotal(extra, Math.max(qty, 1), state.days)
                        return (
                            <div key={extra.id} className={`rounded-2xl border px-3 py-2.5 ${qty > 0 ? 'border-orange/40 bg-orange/5' : 'border-black/10 bg-off-white/60'}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-syne text-[12.5px] font-bold text-navy">{extra.name}</div>
                                        {extra.feedescription && <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted">{extra.feedescription}</p>}
                                        <div className="mt-1 text-[11px] font-semibold text-orange">
                                            +${extra.fees} {isDaily ? copy.perDay : copy.perRental}
                                            {isDaily ? ` · $${amount} ${copy.total}` : ''}
                                        </div>
                                    </div>
                                    <div className="flex flex-shrink-0 items-center gap-1.5">
                                        <button type="button" onClick={() => updateExtra(extra, -1, 9)} disabled={qty === 0} className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-muted disabled:opacity-30">
                                            <Minus size={11} />
                                        </button>
                                        <span className="w-4 text-center text-[12px] font-bold text-navy">{qty}</span>
                                        <button type="button" onClick={() => updateExtra(extra, 1, 9)} className="flex h-7 w-7 items-center justify-center rounded-full border border-orange/30 text-orange">
                                            <Plus size={11} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }) : (
                        <p className="rounded-2xl bg-off-white px-3 py-3 text-[12px] text-muted">No optional extras returned for this vehicle.</p>
                    )}
                </div>
            </div>

            <div className="rounded-2xl border border-navy/10 bg-navy px-3 py-3 text-white">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/65">{copy.priceNotice}</div>
                <div className="space-y-1.5 text-[12px]">
                    <div className="flex justify-between gap-2"><span>{copy.vehicle}</span><span>${totals.vehicleTotal.toLocaleString()}</span></div>
                    {totals.insuranceTotal > 0 && <div className="flex justify-between gap-2"><span>{copy.insurance}</span><span>+${totals.insuranceTotal.toLocaleString()}</span></div>}
                    {totals.extrasTotal > 0 && <div className="flex justify-between gap-2"><span>{copy.optionalExtras}</span><span>+${totals.extrasTotal.toLocaleString()}</span></div>}
                    {totals.afterHourTotal > 0 && <div className="flex justify-between gap-2"><span>After-hours</span><span>+${totals.afterHourTotal.toLocaleString()}</span></div>}
                    {totals.relocationTotal > 0 && <div className="flex justify-between gap-2"><span>Relocation</span><span>+${totals.relocationTotal.toLocaleString()}</span></div>}
                    {totals.youngDriverTotal > 0 && <div className="flex justify-between gap-2"><span>{copy.youngDriverFee}</span><span>+${totals.youngDriverTotal.toLocaleString()}</span></div>}
                    <div className="mt-2 border-t border-white/15 pt-2 flex justify-between font-syne text-[15px] font-extrabold">
                        <span>{copy.total}</span>
                        <span className="text-orange">${totals.grandTotal.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700">{state.error}</p>}

            <button type="button" onClick={onContinue} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange py-3 text-[13px] font-bold text-white shadow-orange-glow transition-colors hover:bg-orange-dark">
                {copy.continueDetails} <ArrowRight size={14} />
            </button>
            <button type="button" onClick={onViewAll} className="w-full rounded-xl border border-black/10 py-2.5 text-[12px] font-bold text-navy transition-colors hover:border-orange hover:text-orange">
                {copy.retrySearch}
            </button>
        </div>
    )
}

function ChatDriverDetailsPanel({ locale, value, errors, onChange, onSubmit }: {
    locale: ChatLocale
    value: {
        firstName: string
        lastName: string
        email: string
        phone: string
        phoneDialCode: string
        phoneDialKey: string
        flightNumber: string
        notes: string
    }
    errors: Record<string, string>
    onChange: (updates: Partial<typeof value>) => void
    onSubmit: () => void
}) {
    const copy = CHAT_COPY[locale]
    const inputClass = (hasError?: boolean) =>
        `w-full rounded-xl border bg-off-white px-3 py-2.5 text-[12.5px] text-navy outline-none transition-colors placeholder:text-muted/55 ${hasError ? 'border-red-400' : 'border-black/10 focus:border-orange'}`

    return (
        <div className="mb-4 rounded-[24px] border border-orange/20 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange">{copy.driverTitle}</div>
            <h4 className="mt-1 font-syne text-[15px] font-extrabold text-navy">{copy.continuePayment}</h4>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{copy.driverHint}</p>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
                <label>
                    <span className="mb-1 block text-[11px] font-bold text-muted">{copy.firstName} *</span>
                    <input className={inputClass(Boolean(errors.firstName))} value={value.firstName} onChange={e => onChange({ firstName: e.target.value })} />
                    {errors.firstName && <p className="mt-1 text-[10.5px] text-red-500">{errors.firstName}</p>}
                </label>
                <label>
                    <span className="mb-1 block text-[11px] font-bold text-muted">{copy.lastName} *</span>
                    <input className={inputClass(Boolean(errors.lastName))} value={value.lastName} onChange={e => onChange({ lastName: e.target.value })} />
                    {errors.lastName && <p className="mt-1 text-[10.5px] text-red-500">{errors.lastName}</p>}
                </label>
                <label className="col-span-2">
                    <span className="mb-1 block text-[11px] font-bold text-muted">{copy.email} *</span>
                    <input type="email" className={inputClass(Boolean(errors.email))} value={value.email} onChange={e => onChange({ email: e.target.value })} placeholder="name@example.com" />
                    {errors.email && <p className="mt-1 text-[10.5px] text-red-500">{errors.email}</p>}
                </label>
                <label className="col-span-2">
                    <span className="mb-1 block text-[11px] font-bold text-muted">{copy.phone} *</span>
                    <div className="flex gap-2">
                        <select
                            value={value.phoneDialKey}
                            onChange={e => {
                                const selected = DIAL_CODES.find(code => code.key === e.target.value) || DIAL_CODES[0]
                                onChange({ phoneDialKey: selected.key, phoneDialCode: selected.dial })
                            }}
                            className="w-[105px] rounded-xl border border-black/10 bg-off-white px-2 py-2.5 text-[12px] text-navy outline-none focus:border-orange"
                        >
                            {DIAL_CODES.map(code => <option key={code.key} value={code.key}>{code.label}</option>)}
                        </select>
                        <input type="tel" className={inputClass(Boolean(errors.phone))} value={value.phone} onChange={e => onChange({ phone: e.target.value })} placeholder="21 000 0000" />
                    </div>
                    {errors.phone && <p className="mt-1 text-[10.5px] text-red-500">{errors.phone}</p>}
                </label>
                <label className="col-span-2">
                    <span className="mb-1 block text-[11px] font-bold text-muted">{copy.flight}</span>
                    <input className={inputClass()} value={value.flightNumber} onChange={e => onChange({ flightNumber: e.target.value })} placeholder="NZ123" />
                </label>
                <label className="col-span-2">
                    <span className="mb-1 block text-[11px] font-bold text-muted">{copy.notes}</span>
                    <textarea rows={3} className={`${inputClass()} resize-none`} value={value.notes} onChange={e => onChange({ notes: e.target.value })} />
                </label>
            </div>

            <button type="button" onClick={onSubmit} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-orange py-3 text-[13px] font-bold text-white shadow-orange-glow transition-colors hover:bg-orange-dark">
                {copy.continuePayment} <ArrowRight size={14} />
            </button>
        </div>
    )
}

function normalizePhoneForPayment(phone: string, dialCode: string) {
    const raw = phone.trim()
    if (raw.startsWith('+')) return raw.replace(/\s+/g, '')
    const localNumber = raw.replace(/\D/g, '').replace(/^0+/, '')
    return `${dialCode || '+64'}${localNumber}`
}

function ChatPaymentPanel({ locale, booking, paymentType, onPaymentTypeChange, loading, error, onStartPayment, clientSecret, reservation }: {
    locale: ChatLocale
    booking: Record<string, any>
    paymentType: 'deposit' | 'full'
    onPaymentTypeChange: (type: 'deposit' | 'full') => void
    loading: boolean
    error: string
    onStartPayment: () => void
    clientSecret: string
    reservation: { ref: string; no: string }
}) {
    const copy = CHAT_COPY[locale]
    const fullAmount = Number(booking.totalAmount || 0)
    const depositAmount = Math.round(fullAmount * 0.1 * 100) / 100
    const payAmount = paymentType === 'deposit' ? depositAmount : fullAmount
    const stripeLocale: StripeElementLocale = locale === 'zh' ? 'zh' : 'en'
    const elementsOptions = useMemo(
        () => clientSecret ? {
            clientSecret,
            locale: stripeLocale,
            appearance: {
                theme: 'stripe' as const,
                variables: {
                    colorPrimary: '#f97316',
                    borderRadius: '12px',
                    fontFamily: 'inherit',
                },
            },
        } : undefined,
        [clientSecret, stripeLocale],
    )

    return (
        <div className="mb-4 rounded-[24px] border border-orange/20 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange">{copy.paymentTitle}</div>
            <h4 className="mt-1 font-syne text-[15px] font-extrabold text-navy">{copy.vehicle}: {booking.vehicleName || 'Vehicle'}</h4>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{copy.paymentHint}</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => onPaymentTypeChange('deposit')}
                    className={`rounded-2xl border px-3 py-3 text-left transition-all ${paymentType === 'deposit' ? 'border-orange bg-orange text-white' : 'border-black/10 bg-off-white text-navy hover:border-orange/30'}`}
                >
                    <div className="font-syne text-[13px] font-extrabold">{copy.deposit}</div>
                    <div className={`mt-0.5 text-[12px] font-bold ${paymentType === 'deposit' ? 'text-white/85' : 'text-orange'}`}>${depositAmount.toLocaleString()}</div>
                </button>
                <button
                    type="button"
                    onClick={() => onPaymentTypeChange('full')}
                    className={`rounded-2xl border px-3 py-3 text-left transition-all ${paymentType === 'full' ? 'border-orange bg-orange text-white' : 'border-black/10 bg-off-white text-navy hover:border-orange/30'}`}
                >
                    <div className="font-syne text-[13px] font-extrabold">{copy.fullPayment}</div>
                    <div className={`mt-0.5 text-[12px] font-bold ${paymentType === 'full' ? 'text-white/85' : 'text-orange'}`}>${fullAmount.toLocaleString()}</div>
                </button>
            </div>

            {!clientSecret && (
                <button
                    type="button"
                    onClick={onStartPayment}
                    disabled={loading || fullAmount <= 0}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-orange py-3 text-[13px] font-bold text-white shadow-orange-glow transition-colors hover:bg-orange-dark disabled:opacity-60"
                >
                    {loading ? copy.creatingBooking : `${copy.startPayment} · $${payAmount.toLocaleString()}`}
                </button>
            )}

            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}

            {clientSecret && elementsOptions && (
                <div className="mt-4">
                    <Elements stripe={stripePromise} options={elementsOptions}>
                        <StripeCheckout
                            payAmount={payAmount}
                            stripeMode={STRIPE_MODE}
                            reservationRef={reservation.ref}
                            reservationNo={reservation.no}
                        />
                    </Elements>
                </div>
            )}
        </div>
    )
}

// ── Main Widget ───────────────────────────────────────────────────────────────

export default function ChatWidget() {
    const pathname = usePathname() || '/'
    const [open, setOpen] = useState(false)
    const [sessionId, setSessionId] = useState('')
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [status, setStatus] = useState<'bot' | 'human'>('bot')
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [error, setError] = useState('')
    const [chatLocale, setChatLocale] = useState<ChatLocale>('en')
    const [showLanguageChoice, setShowLanguageChoice] = useState(true)
    // How many consecutive questions the bot couldn't answer
    const [unansweredCount, setUnansweredCount] = useState(0)
    // Whether to show the contact collection form
    const [showContactForm, setShowContactForm] = useState(false)
    const [faqs, setFaqs] = useState<ChatFaq[]>(DEFAULT_FAQS)
    const defaultFinderDates = useMemo(() => getDefaultFinderDates(), [])
    const [quickFinder, setQuickFinder] = useState<QuickFinderState>({
        pickupLocation: 'Christchurch',
        dropoffLocation: 'Christchurch',
        pickupDate: defaultFinderDates.pickupDate,
        dropoffDate: defaultFinderDates.dropoffDate,
        adults: 2,
        children: 0,
        largeBags: 1,
        smallBags: 1,
        childSeat: false,
        promoCode: '',
    })
    const [showQuickFinder, setShowQuickFinder] = useState(false)
    const [quickFinderSubmitted, setQuickFinderSubmitted] = useState(false)
    const [quickFinderLoading, setQuickFinderLoading] = useState(false)
    const [featuredVehicles, setFeaturedVehicles] = useState<FeaturedVehicle[]>([])
    const [recommendedVehicles, setRecommendedVehicles] = useState<FeaturedVehicle[]>([])
    const [recommendationSource, setRecommendationSource] = useState<'live' | 'featured' | 'none'>('none')
    const [recommendationSearchResults, setRecommendationSearchResults] = useState<any>(null)
    const [chatBooking, setChatBooking] = useState<ChatBookingState | null>(null)
    const [showDriverDetails, setShowDriverDetails] = useState(false)
    const [showPaymentPanel, setShowPaymentPanel] = useState(false)
    const [driverDetails, setDriverDetails] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        phoneDialCode: '+64',
        phoneDialKey: 'NZ',
        flightNumber: '',
        notes: '',
    })
    const [driverErrors, setDriverErrors] = useState<Record<string, string>>({})
    const [paymentBooking, setPaymentBooking] = useState<Record<string, any>>({})
    const [chatPaymentType, setChatPaymentType] = useState<'deposit' | 'full'>('deposit')
    const [chatPaymentLoading, setChatPaymentLoading] = useState(false)
    const [chatPaymentError, setChatPaymentError] = useState('')
    const [chatPaymentClientSecret, setChatPaymentClientSecret] = useState('')
    const [chatPaymentReservation, setChatPaymentReservation] = useState<{ ref: string; no: string }>({ ref: '', no: '' })
    const [storedBookingMeta, setStoredBookingMeta] = useState({ driverAge: 'over26', pickupTime: '10:00', dropoffTime: '10:00' })
    const [showPageHint, setShowPageHint] = useState(false)
    const [pageHintsDisabled, setPageHintsDisabled] = useState(false)
    const [floatingPosition, setFloatingPosition] = useState<{ left: number; top: number } | null>(null)
    const [isDraggingFloatingButton, setIsDraggingFloatingButton] = useState(false)

    const latestTimestampRef = useRef(0)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)
    const messagesContainerRef = useRef<HTMLDivElement | null>(null)
    const floatingButtonRef = useRef<HTMLButtonElement | null>(null)
    const floatingDragRef = useRef<{
        pointerId: number
        startX: number
        startY: number
        originLeft: number
        originTop: number
        dragging: boolean
        cancelled: boolean
        timer: number | null
    } | null>(null)
    const suppressFloatingClickRef = useRef(false)
    const openRef = useRef(false)
    const pageContext = useMemo(() => getBookingPageContext(pathname, chatLocale), [pathname, chatLocale])

    // ── Firestore sync ────────────────────────────────────────────────────────

    function syncFromChat(chat: ChatSession | null | undefined) {
        if (!chat) return
        const fromFirestore = Array.isArray(chat.messages) ? sortMessages(chat.messages) : []
        const rawBase = fromFirestore.length > 0 ? fromFirestore : []
        const storedWelcomeTexts = [getInitialBotMessage('en').text, getInitialBotMessage('zh').text]
        const isStoredWelcomeOnly = rawBase.length === 1 && rawBase[0].sender === 'agent' && storedWelcomeTexts.includes(rawBase[0].text)
        // Do not show a stale welcome message before the visitor selects a language.
        const base = isStoredWelcomeOnly ? [] : rawBase
        const newestMessage = base[base.length - 1]

        if (newestMessage && newestMessage.timestamp > latestTimestampRef.current && newestMessage.sender === 'agent' && !openRef.current) {
            playNotificationSound()
        }

        latestTimestampRef.current = newestMessage?.timestamp ?? latestTimestampRef.current

        // Merge Firestore messages WITH local state so locally-added bot
        // replies are never overwritten by an incoming snapshot.
        setMessages(current => mergeMessages(current, base))
        setStatus(chat.status)
        setUnreadCount(chat.unreadCount ?? 0)
    }

    async function refreshChatSession(targetSessionId: string) {
        const response = await fetch(`/api/chat-session?sessionId=${encodeURIComponent(targetSessionId)}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to refresh chat.')
        syncFromChat(data.chat as ChatSession | null)
    }

    useEffect(() => { openRef.current = open }, [open])

    useEffect(() => {
        const detected = detectChatLocale()
        setChatLocale(detected)
        setShowLanguageChoice(true)
        try {
            const raw = window.sessionStorage.getItem(BOOKING_STORAGE_KEY)
            if (raw) {
                const parsed = JSON.parse(raw)
                setStoredBookingMeta({
                    driverAge: parsed.driverAge || 'over26',
                    pickupTime: parsed.pickupTime || '10:00',
                    dropoffTime: parsed.dropoffTime || '10:00',
                })
                const dial = parsed.phoneDialCode || '+64'
                const dialCode = DIAL_CODES.find(code => code.dial === dial) || DIAL_CODES[0]
                setDriverDetails({
                    firstName: parsed.firstName || '',
                    lastName: parsed.lastName || '',
                    email: parsed.email || '',
                    phone: parsed.phone || '',
                    phoneDialCode: dialCode.dial,
                    phoneDialKey: dialCode.key,
                    flightNumber: parsed.flightNumber || '',
                    notes: parsed.notes || '',
                })
            }
        } catch {}
    }, [])

    useEffect(() => {
        fetch('/api/public/chat-faqs')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data?.faqs) && data.faqs.length > 0) setFaqs(data.faqs)
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        fetch('/api/public/featured-vehicles')
            .then(res => res.json())
            .then(data => { if (Array.isArray(data)) setFeaturedVehicles(data) })
            .catch(() => {})
    }, [])

    useEffect(() => {
        setShowPageHint(false)
        if (pathname.startsWith('/admin')) return

        const disabled = window.localStorage.getItem(PAGE_HINT_DISMISSED_KEY) === 'yes'
        setPageHintsDisabled(disabled)
        if (disabled) return

        const timer = window.setTimeout(() => {
            if (!openRef.current) setShowPageHint(true)
        }, 15000)

        return () => window.clearTimeout(timer)
    }, [pathname])

    useEffect(() => {
        const existing = window.localStorage.getItem(STORAGE_KEY)
        const id = existing || createSessionId()
        if (!existing) window.localStorage.setItem(STORAGE_KEY, id)
        setSessionId(id)
    }, [])

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(CHAT_WIDGET_POSITION_KEY)
            if (!stored) return
            const position = JSON.parse(stored)
            if (Number.isFinite(position?.left) && Number.isFinite(position?.top)) {
                const size = window.innerWidth >= 640 ? 64 : 56
                setFloatingPosition({
                    left: Math.max(12, Math.min(position.left, window.innerWidth - size - 12)),
                    top: Math.max(12, Math.min(position.top, window.innerHeight - size - 12)),
                })
            }
        } catch {}
    }, [])

    useEffect(() => {
        if (!sessionId) return
        let unsubscribe = () => {}
        let cancelled = false

        async function start() {
            await ensureAnonymousAuth()
            const firestore = getFirebaseFirestore()
            if (!firestore) throw new Error('Firebase chat is not configured yet.')
            const chatRef = doc(firestore, 'chats', sessionId)
            unsubscribe = onSnapshot(
                chatRef,
                snapshot => { if (cancelled || !snapshot.exists()) return; syncFromChat(snapshot.data() as ChatSession) },
                async () => { try { await refreshChatSession(sessionId) } catch { setError('Chat sync is temporarily unavailable.') } },
            )
        }

        start().catch(() => { setError('Chat is temporarily unavailable.') })
        return () => { cancelled = true; unsubscribe() }
    }, [sessionId])

    useEffect(() => {
        if (!open || !sessionId) return
        refreshChatSession(sessionId).catch(() => {})
        const interval = window.setInterval(() => { refreshChatSession(sessionId).catch(() => {}) }, 3000)
        return () => window.clearInterval(interval)
    }, [open, sessionId])

    useEffect(() => {
        const container = messagesContainerRef.current
        if (!container) return
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }, [messages, open, showContactForm, showQuickFinder, quickFinderSubmitted, chatBooking, showDriverDetails, showPaymentPanel, chatPaymentClientSecret])

    useEffect(() => {
        if (!open || !sessionId || unreadCount === 0) return
        fetch('/api/chat-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) }).catch(() => {})
    }, [open, sessionId, unreadCount])

    // ── Helpers ───────────────────────────────────────────────────────────────

    function addLocalMessage(text: string, sender: 'user' | 'agent', timestamp?: number) {
        const msg: ChatMessage = { sender, text, timestamp: timestamp ?? Date.now() }
        setMessages(current => mergeMessages(current, [msg]))
        latestTimestampRef.current = Math.max(latestTimestampRef.current, msg.timestamp)
        return msg
    }

    async function saveMessageToFirestore(text: string, sender: 'user' | 'agent', timestamp: number) {
        await fetch('/api/chat/user-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, text, sender, timestamp }),
        }).catch(() => {})
    }

    function dismissQuickFinder() {
        setShowQuickFinder(false)
        window.localStorage.setItem(QUICK_FINDER_DISMISSED_KEY, 'yes')
    }

    function chooseChatLanguage(nextLocale: ChatLocale) {
        setChatLocale(nextLocale)
        setShowLanguageChoice(false)
        window.localStorage.setItem(CHAT_LANGUAGE_KEY, nextLocale)
        setMessages(current => {
            const welcomeMessages = [getInitialBotMessage('en').text, getInitialBotMessage('zh').text]
            const isUntouchedWelcome = current.length === 1 && current[0].sender === 'agent' && welcomeMessages.includes(current[0].text)
            return current.length === 0 || isUntouchedWelcome ? [getInitialBotMessage(nextLocale)] : current
        })
        if (!quickFinderSubmitted && !chatBooking) setShowQuickFinder(true)
    }

    async function submitQuickFinder() {
        setQuickFinderLoading(true)
        setError('')
        try {
            const summary = [
                'Quick finder request',
                `Pickup: ${quickFinder.pickupLocation} · ${quickFinder.pickupDate}`,
                `Return: ${quickFinder.dropoffLocation} · ${quickFinder.dropoffDate}`,
                `Travellers: ${quickFinder.adults} adult${quickFinder.adults > 1 ? 's' : ''}, ${quickFinder.children} child${quickFinder.children !== 1 ? 'ren' : ''}`,
                `Luggage: ${quickFinder.largeBags} large, ${quickFinder.smallBags} small`,
                quickFinder.promoCode ? `Promo: ${quickFinder.promoCode}` : 'Promo: none',
                quickFinder.childSeat ? 'Child seat: recommended' : '',
            ].filter(Boolean).join('\n')

            const now = Date.now()
            addLocalMessage(summary, 'user', now)
            await saveMessageToFirestore(summary, 'user', now)
            let nextRecommended: FeaturedVehicle[] = []
            let nextSource: 'live' | 'featured' | 'none' = 'none'

            try {
                const response = await fetch('/api/rcm/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pickupLocation: quickFinder.pickupLocation,
                        dropoffLocation: quickFinder.dropoffLocation,
                        pickupDate: quickFinder.pickupDate,
                        dropoffDate: quickFinder.dropoffDate,
                        pickupTime: '10:00',
                        dropoffTime: '10:00',
                        promoCode: quickFinder.promoCode,
                    }),
                })
                const data = await response.json()
                const liveCars = Array.isArray(data?.data?.availablecars)
                    ? data.data.availablecars
                    : []
                nextRecommended = sortVehiclesForFinder(liveCars, quickFinder)
                if (nextRecommended.length > 0) {
                    nextSource = 'live'
                    setRecommendationSearchResults(data.data)
                }
            } catch {}

            if (nextRecommended.length === 0) {
                nextRecommended = sortVehiclesForFinder(featuredVehicles, quickFinder)
                nextSource = nextRecommended.length > 0 ? 'featured' : 'none'
                setRecommendationSearchResults(null)
            }

            setRecommendedVehicles(nextRecommended)
            setRecommendationSource(nextSource)
            window.localStorage.setItem(QUICK_FINDER_DISMISSED_KEY, 'yes')
            setQuickFinderSubmitted(true)
            setShowQuickFinder(false)
            setTimeout(() => {
                addLocalMessage(
                    nextSource === 'live'
                        ? CHAT_COPY[chatLocale].liveFound
                        : nextSource === 'featured'
                            ? CHAT_COPY[chatLocale].featuredFound
                            : CHAT_COPY[chatLocale].noPerfectMatch,
                    'agent',
                )
            }, 250)
        } finally {
            setQuickFinderLoading(false)
        }
    }

    function goToQuickSearch() {
        const existingRaw = window.sessionStorage.getItem(BOOKING_STORAGE_KEY)
        let existing: Record<string, any> = {}
        try { existing = existingRaw ? JSON.parse(existingRaw) : {} } catch {}

        window.sessionStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify({
            ...existing,
            pickupLocation: quickFinder.pickupLocation,
            pickupLocationId: locationId(quickFinder.pickupLocation),
            dropoffLocation: quickFinder.dropoffLocation,
            dropoffLocationId: locationId(quickFinder.dropoffLocation),
            pickupDate: quickFinder.pickupDate,
            pickupTime: existing.pickupTime || '10:00',
            dropoffDate: quickFinder.dropoffDate,
            dropoffTime: existing.dropoffTime || '10:00',
            driverAge: existing.driverAge || 'over26',
            quickFinderPassengers: passengerCount(quickFinder),
            quickFinderAdults: quickFinder.adults,
            quickFinderChildren: quickFinder.children,
            quickFinderLargeBags: quickFinder.largeBags,
            quickFinderSmallBags: quickFinder.smallBags,
            childSeatRequested: quickFinder.childSeat,
            promoCode: quickFinder.promoCode,
        }))

        const query = new URLSearchParams({
            pickupLocation: quickFinder.pickupLocation,
            dropoffLocation: quickFinder.dropoffLocation,
            pickupDate: quickFinder.pickupDate,
            pickupTime: existing.pickupTime || '10:00',
            dropoffDate: quickFinder.dropoffDate,
            dropoffTime: existing.dropoffTime || '10:00',
            driverAge: existing.driverAge || 'over26',
            promoCode: quickFinder.promoCode,
        })

        window.location.href = `/booking/vehicles?${query.toString()}`
    }

    async function selectRecommendedVehicle(vehicle: FeaturedVehicle, finderOverride?: Partial<QuickFinderState>) {
        const finder = { ...quickFinder, ...finderOverride }
        if (!isRecommendedVehicleSelectable(vehicle)) {
            if (finderOverride) {
                setError(chatLocale === 'zh' ? '这辆车缺少实时预订信息，请重新获取推荐。' : 'This vehicle is missing live booking details. Please refresh the recommendation.')
            } else {
                goToQuickSearch()
            }
            return
        }

        const existingRaw = window.sessionStorage.getItem(BOOKING_STORAGE_KEY)
        let existing: Record<string, any> = {}
        try { existing = existingRaw ? JSON.parse(existingRaw) : {} } catch {}

        const pickupTime = existing.pickupTime || '10:00'
        const dropoffTime = existing.dropoffTime || '10:00'
        const driverAge = existing.driverAge || 'over26'
        const promoCode = finder.promoCode || existing.promoCode || ''
        window.sessionStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify({ ...existing, promoCode }))
        setStoredBookingMeta({ driverAge, pickupTime, dropoffTime })
        const days = calcDays(finder.pickupDate, pickupTime, finder.dropoffDate, dropoffTime)
        const pricing = getRecommendedVehiclePricing(vehicle, days)
        const vehicleInsurance = (recommendationSearchResults?.insuranceoptions || [])
            .filter((ins: any) => ins.vehiclecategoryid === vehicle.vehiclecategoryid)
            .filter((ins: any, idx: number, arr: any[]) =>
                arr.findIndex((entry: any) => entry.id === ins.id) === idx
            )

        const initialChatBooking: ChatBookingState = {
            vehicle,
            days,
            basePricePerDay: Number(vehicle.avgrate || pricing.effectivePerDay),
            pricePerDay: pricing.effectivePerDay,
            promoDiscountAmount: pricing.promoDiscount,
            insuranceOptions: vehicleInsurance,
            optionalFees: [],
            mandatoryFees: [],
            selectedInsuranceId: vehicleInsurance.find((item: any) => item.isdefault)?.id ?? null,
            extras: {},
            loading: true,
        }

        setChatBooking(initialChatBooking)
        setQuickFinderSubmitted(false)

        try {
            const response = await fetch('/api/rcm/step3', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicleCategoryTypeId: vehicle.vehiclecategorytypeid,
                    vehicleCategoryId: vehicle.vehiclecategoryid,
                    pickupLocation: finder.pickupLocation,
                    dropoffLocation: finder.dropoffLocation,
                    pickupDate: finder.pickupDate,
                    dropoffDate: finder.dropoffDate,
                    pickupTime,
                    dropoffTime,
                    promoCode,
                }),
            })
            const result = await response.json()
            if (!result.success) throw new Error(result.error || 'Unable to load booking options.')
            const optionalFees = (result.data?.optionalfees || []).filter((fee: any) => fee.id !== YOUNG_DRIVER_FEE_ID)
            const stepInsurance = (result.data?.insuranceoptions || [])
                .filter((ins: any) => ins.vehiclecategoryid === vehicle.vehiclecategoryid)
                .filter((ins: any, idx: number, arr: any[]) => arr.findIndex((entry: any) => entry.id === ins.id) === idx)
            const nextInsurance = stepInsurance.length > 0 ? stepInsurance : vehicleInsurance
            setChatBooking(current => current ? ({
                ...current,
                insuranceOptions: nextInsurance,
                optionalFees,
                mandatoryFees: result.data?.mandatoryfees || [],
                selectedInsuranceId: nextInsurance.find((item: any) => item.isdefault)?.id ?? current.selectedInsuranceId,
                loading: false,
            }) : current)
        } catch (err) {
            setChatBooking(current => current ? ({
                ...current,
                loading: false,
                error: err instanceof Error ? err.message : 'Unable to load booking options.',
            }) : current)
        }
    }

    useEffect(() => {
        function handleAiBooking(event: Event) {
            const detail = (event as CustomEvent<{ vehicle?: FeaturedVehicle; search?: Record<string, any>; responseLanguage?: string }>).detail
            if (!detail?.vehicle) return
            const search = detail.search || {}
            const responseLanguage = String(detail.responseLanguage || search.responseLanguage || '').toLowerCase()
            const targetLocale: ChatLocale = /chinese|中文|汉语|漢語/.test(responseLanguage) ? 'zh' : chatLocale
            const finder: QuickFinderState = {
                pickupLocation: search.pickupLocation || 'Christchurch',
                dropoffLocation: search.dropoffLocation || search.pickupLocation || 'Christchurch',
                pickupDate: search.pickupDate || getDefaultFinderDates().pickupDate,
                dropoffDate: search.dropoffDate || getDefaultFinderDates().dropoffDate,
                adults: Number(search.passengers || 2),
                children: Number(search.children || 0),
                largeBags: Number(search.largeBags || 0),
                smallBags: Number(search.smallBags || 0),
                childSeat: false,
                promoCode: String(search.promoCode || '').toUpperCase(),
            }
            setQuickFinder(finder)
            setRecommendedVehicles([detail.vehicle])
            setRecommendationSource('live')
            setQuickFinderSubmitted(false)
            setShowQuickFinder(false)
            setShowLanguageChoice(false)
            setOpen(true)
            setChatLocale(targetLocale)
            window.localStorage.setItem(CHAT_LANGUAGE_KEY, targetLocale)
            setMessages(current => [...current, {
                sender: 'agent',
                text: targetLocale === 'zh' ? '我会在这里继续完成这辆车的预订。' : 'I will continue this booking here without opening another page.',
                timestamp: Date.now(),
            }])
            selectRecommendedVehicle(detail.vehicle, finder)
        }

        window.addEventListener('yitu-ai-start-booking', handleAiBooking)
        return () => window.removeEventListener('yitu-ai-start-booking', handleAiBooking)
    }, [chatLocale])

    function continueChatBooking() {
        if (!chatBooking) return

        const existingRaw = window.sessionStorage.getItem(BOOKING_STORAGE_KEY)
        let existing: Record<string, any> = {}
        try { existing = existingRaw ? JSON.parse(existingRaw) : {} } catch {}

        const pickupTime = existing.pickupTime || '10:00'
        const dropoffTime = existing.dropoffTime || '10:00'
        const driverAge = existing.driverAge || 'over26'
        const totals = calculateChatBookingTotals(chatBooking, driverAge, pickupTime, dropoffTime)

        window.sessionStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify({
            ...existing,
            pickupLocation: quickFinder.pickupLocation,
            pickupLocationId: locationId(quickFinder.pickupLocation),
            dropoffLocation: quickFinder.dropoffLocation,
            dropoffLocationId: locationId(quickFinder.dropoffLocation),
            pickupDate: quickFinder.pickupDate,
            pickupTime,
            dropoffDate: quickFinder.dropoffDate,
            dropoffTime,
            driverAge,
            days: chatBooking.days,
            afterHourFee: totals.afterHourTotal,
            relocationFee: totals.relocationTotal,
            mandatoryFeeIds: chatBooking.mandatoryFees.map((fee: any) => fee.id),
            vehicleId: String(chatBooking.vehicle.vehiclecategoryid),
            vehicleCategoryTypeId: Number(chatBooking.vehicle.vehiclecategorytypeid),
            vehicleName: chatBooking.vehicle.categoryfriendlydescription || chatBooking.vehicle.vehiclecategory || 'Selected vehicle',
            basePricePerDay: chatBooking.basePricePerDay,
            pricePerDay: chatBooking.pricePerDay,
            promoCode: existing.promoCode || '',
            promoDiscountType: '',
            promoDiscountValue: 0,
            promoDiscountAmount: chatBooking.promoDiscountAmount,
            insuranceOptions: chatBooking.insuranceOptions,
            selectedInsuranceId: chatBooking.selectedInsuranceId,
            extras: chatBooking.extras,
            totalAmount: totals.grandTotal,
            reservationRef: '',
            quickFinderPassengers: passengerCount(quickFinder),
            quickFinderAdults: quickFinder.adults,
            quickFinderChildren: quickFinder.children,
            quickFinderLargeBags: quickFinder.largeBags,
            quickFinderSmallBags: quickFinder.smallBags,
            childSeatRequested: quickFinder.childSeat,
        }))

        setShowDriverDetails(true)
        setChatBooking(null)
    }

    function submitDriverDetails() {
        const copy = CHAT_COPY[chatLocale]
        const nextErrors: Record<string, string> = {}
        if (!driverDetails.firstName.trim()) nextErrors.firstName = copy.required
        if (!driverDetails.lastName.trim()) nextErrors.lastName = copy.required
        if (!driverDetails.email.trim()) nextErrors.email = copy.required
        else if (!/\S+@\S+\.\S+/.test(driverDetails.email)) nextErrors.email = copy.invalidEmail
        if (!driverDetails.phone.trim()) nextErrors.phone = copy.required

        setDriverErrors(nextErrors)
        if (Object.keys(nextErrors).length > 0) return

        const existingRaw = window.sessionStorage.getItem(BOOKING_STORAGE_KEY)
        let existing: Record<string, any> = {}
        try { existing = existingRaw ? JSON.parse(existingRaw) : {} } catch {}

        const nextBooking: Record<string, any> = {
            ...existing,
            firstName: driverDetails.firstName.trim(),
            lastName: driverDetails.lastName.trim(),
            email: driverDetails.email.trim(),
            phone: driverDetails.phone.trim(),
            phoneDialCode: driverDetails.phoneDialCode,
            flightNumber: driverDetails.flightNumber.trim(),
            notes: driverDetails.notes.trim(),
        }

        window.sessionStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(nextBooking))
        setPaymentBooking(nextBooking)
        setShowDriverDetails(false)
        setShowPaymentPanel(true)
        setChatPaymentClientSecret('')
        setChatPaymentReservation({ ref: '', no: '' })
        setChatPaymentError('')
    }

    async function startChatPayment() {
        const booking = paymentBooking
        const fullAmount = Number(booking.totalAmount || 0)
        const payAmount = chatPaymentType === 'deposit'
            ? Math.round(fullAmount * 0.1 * 100) / 100
            : fullAmount

        setChatPaymentLoading(true)
        setChatPaymentError('')
        try {
            const bookingRes = await fetch('/api/rcm/create-booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pickupDate: booking.pickupDate,
                    pickupTime: booking.pickupTime,
                    dropoffDate: booking.dropoffDate,
                    dropoffTime: booking.dropoffTime,
                    pickupLocation: booking.pickupLocation,
                    pickupLocationId: booking.pickupLocationId,
                    dropoffLocation: booking.dropoffLocation,
                    dropoffLocationId: booking.dropoffLocationId,
                    vehicleName: booking.vehicleName,
                    vehicleCategoryId: Number(booking.vehicleId),
                    vehicleCategoryTypeId: booking.vehicleCategoryTypeId,
                    totalAmount: fullAmount,
                    paymentType: chatPaymentType,
                    selectedInsuranceId: booking.selectedInsuranceId,
                    extras: booking.extras,
                    driverAge: booking.driverAge,
                    firstName: booking.firstName,
                    lastName: booking.lastName,
                    email: booking.email,
                    phone: normalizePhoneForPayment(booking.phone || '', booking.phoneDialCode || '+64'),
                    flightNumber: booking.flightNumber,
                    notes: booking.notes,
                    promoCode: booking.promoCode,
                    mandatoryFeeIds: booking.mandatoryFeeIds || [],
                }),
            })
            const bookingData = await bookingRes.json()
            if (!bookingData.success) throw new Error(bookingData.error || 'Failed to create booking')

            const reservationRef = bookingData.reservationRef
            const reservationNo = bookingData.reservationNo || ''
            const intentRes = await fetch('/api/payments/stripe/rental/create-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservationRef,
                    reservationNo,
                    amountCents: Math.round(payAmount * 100),
                    currency: 'nzd',
                    stripeMode: STRIPE_MODE,
                    description: `YITU rental ${reservationRef} (${chatPaymentType === 'deposit' ? '10% deposit' : 'full payment'})`,
                    firstName: booking.firstName,
                    lastName: booking.lastName,
                    email: booking.email,
                    phone: booking.phone,
                }),
            })
            const intentData = await intentRes.json()
            if (!intentData.success || !intentData.clientSecret) {
                throw new Error(intentData.error || CHAT_COPY[chatLocale].paymentError)
            }

            const updatedBooking = { ...booking, reservationRef, reservationNo, paymentType: chatPaymentType }
            window.sessionStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(updatedBooking))
            setPaymentBooking(updatedBooking)
            setChatPaymentReservation({ ref: reservationRef, no: reservationNo })
            setChatPaymentClientSecret(intentData.clientSecret)
        } catch (err) {
            setChatPaymentError(err instanceof Error ? err.message : CHAT_COPY[chatLocale].paymentError)
        } finally {
            setChatPaymentLoading(false)
        }
    }

    // ── FAQ mode: handle user message locally ─────────────────────────────────

    async function handleFaqMessage(text: string) {
        if (showLanguageChoice) return
        const trimmed = text.trim()
        if (!trimmed) return

        const now = Date.now()
        setInput('')
        setShowLanguageChoice(false)
        addLocalMessage(trimmed, 'user', now)
        await saveMessageToFirestore(trimmed, 'user', now)

        const faqReply = matchFaqReply(trimmed, [...pageContext.faqs, ...faqs])

        if (faqReply) {
            // Reset unanswered counter on a successful FAQ match
            setUnansweredCount(0)
            setTimeout(() => addLocalMessage(faqReply, 'agent'), 300)
        } else {
            const nextCount = unansweredCount + 1
            setUnansweredCount(nextCount)

            if (nextCount >= UNANSWERED_THRESHOLD) {
                // Proactively offer human support after repeated misses
                    setTimeout(() => {
                    addLocalMessage(CHAT_COPY[chatLocale].supportOffer, 'agent')
                }, 300)
            } else {
                setTimeout(() => addLocalMessage(getNoMatchReply(), 'agent'), 300)
            }
        }
    }

    // ── Contact form submit: send to Telegram + escalate to human ─────────────

    async function handleContactSubmit(name: string, phone: string) {
        setSending(true)
        setError('')

        // Collect the last user question as context
        const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user')?.text || '(no message)'

        const telegramText = buildTelegramMessage({
            sessionId,
            name,
            phone,
            message: lastUserMsg,
        })

        try {
            const response = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: telegramText, sessionId }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to send')

            setShowContactForm(false)
            setStatus('human')
            addLocalMessage(getSupportConfirmedReply(), 'agent')
            await saveMessageToFirestore(`[Contact request] Name: ${name} | Phone: ${phone} | Query: ${lastUserMsg}`, 'user', Date.now())
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send. Please try again.')
        } finally {
            setSending(false)
        }
    }

    // ── Human mode: send directly to Telegram ────────────────────────────────

    async function handleHumanMessage(text: string) {
        const trimmed = text.trim()
        if (!trimmed) return

        setSending(true)
        setInput('')
        setError('')

        const now = Date.now()
        addLocalMessage(trimmed, 'user', now)
        await saveMessageToFirestore(trimmed, 'user', now)

        try {
            await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `Session: ${sessionId}\n${trimmed}`, sessionId }),
            })
        } catch {
            setError('Could not send. Please try again.')
        } finally {
            setSending(false)
        }
    }

    function handleSend() {
        if (showLanguageChoice) return
        if (status === 'human') {
            handleHumanMessage(input)
        } else {
            handleFaqMessage(input)
        }
    }

    function toggleChat() {
        if (open) {
            if (showQuickFinder) dismissQuickFinder()
            window.dispatchEvent(new Event('yitu:chat-closed'))
        }
        setOpen(v => !v)
    }

    function dismissPageHint() {
        setShowPageHint(false)
    }

    function disablePageHints() {
        window.localStorage.setItem(PAGE_HINT_DISMISSED_KEY, 'yes')
        setPageHintsDisabled(true)
        setShowPageHint(false)
    }

    function clampFloatingPosition(left: number, top: number) {
        const size = window.innerWidth >= 640 ? 64 : 56
        return {
            left: Math.max(12, Math.min(left, window.innerWidth - size - 12)),
            top: Math.max(12, Math.min(top, window.innerHeight - size - 12)),
        }
    }

    function handleFloatingPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
        if (event.button !== 0) return
        const rect = event.currentTarget.getBoundingClientRect()
        const drag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originLeft: rect.left,
            originTop: rect.top,
            dragging: false,
            cancelled: false,
            timer: null as number | null,
        }
        floatingDragRef.current = drag
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.timer = window.setTimeout(() => {
            if (floatingDragRef.current !== drag || drag.cancelled) return
            drag.dragging = true
            setFloatingPosition(clampFloatingPosition(drag.originLeft, drag.originTop))
            setIsDraggingFloatingButton(true)
        }, 320)
    }

    function handleFloatingPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
        const drag = floatingDragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
        if (!drag.dragging && distance > 8) {
            drag.cancelled = true
            if (drag.timer) window.clearTimeout(drag.timer)
            return
        }
        if (!drag.dragging) return
        event.preventDefault()
        setFloatingPosition(clampFloatingPosition(
            drag.originLeft + event.clientX - drag.startX,
            drag.originTop + event.clientY - drag.startY,
        ))
    }

    function handleFloatingPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
        const drag = floatingDragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        if (drag.timer) window.clearTimeout(drag.timer)
        if (drag.dragging) {
            setIsDraggingFloatingButton(false)
            setFloatingPosition(current => {
                if (current) window.localStorage.setItem(CHAT_WIDGET_POSITION_KEY, JSON.stringify(current))
                return current
            })
            suppressFloatingClickRef.current = true
            window.setTimeout(() => { suppressFloatingClickRef.current = false }, 0)
        } else if (drag.cancelled) {
            suppressFloatingClickRef.current = true
            window.setTimeout(() => { suppressFloatingClickRef.current = false }, 0)
        }
        floatingDragRef.current = null
    }

    const copy = CHAT_COPY[chatLocale]
    const headerLabel = useMemo(() => (status === 'human' ? copy.headerSupport : copy.headerAssistant), [status, copy])
    const showSupportButton = status === 'bot' && !showContactForm && !showQuickFinder && !showLanguageChoice && !chatBooking && !showDriverDetails && !showPaymentPanel
    const showContextQuestions = status === 'bot' && !showContactForm && !showQuickFinder && !showLanguageChoice && !chatBooking && !showDriverDetails && !showPaymentPanel && pageContext.faqs.length > 0
    const showCommonQuestions = status === 'bot' && !showContactForm && !showQuickFinder && !showLanguageChoice && !chatBooking && !showDriverDetails && !showPaymentPanel && faqs.length > 0

    return (
        <>
            <div
                className={`fixed z-50 ${floatingPosition ? '' : 'bottom-4 right-4 sm:bottom-5 sm:right-5'}`}
                style={floatingPosition ? { left: floatingPosition.left, top: floatingPosition.top } : undefined}
            >
                {!open && showPageHint && !pageHintsDisabled && (
                    <div className="absolute bottom-[calc(100%+10px)] right-0 w-max max-w-[calc(100vw-28px)] animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-orange/20 bg-white p-3 text-left text-navy shadow-[0_14px_35px_rgba(15,35,71,0.18)] sm:max-w-[310px]">
                        <div className="flex items-start gap-2">
                            <button
                                type="button"
                                onClick={() => { dismissPageHint(); toggleChat() }}
                                className="flex min-w-0 flex-1 items-start gap-2 text-left text-[12px] font-semibold leading-relaxed"
                            >
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange text-[11px] font-extrabold text-white">!</span>
                                <span className="min-w-0">{pageContext.hint}</span>
                            </button>
                            <button
                                type="button"
                                onClick={dismissPageHint}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[16px] leading-none text-muted transition-colors hover:bg-black/5 hover:text-navy"
                                aria-label="关闭提醒"
                            >
                                ×
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={disablePageHints}
                            className="mt-2 ml-7 text-[10px] font-medium text-muted underline decoration-black/20 underline-offset-2 transition-colors hover:text-navy"
                        >
                            不再提示
                        </button>
                    </div>
                )}
                <button
                    ref={floatingButtonRef}
                    onPointerDown={handleFloatingPointerDown}
                    onPointerMove={handleFloatingPointerMove}
                    onPointerUp={handleFloatingPointerUp}
                    onPointerCancel={handleFloatingPointerUp}
                    onClick={() => {
                        if (suppressFloatingClickRef.current) return
                        setShowPageHint(false)
                        toggleChat()
                    }}
                    className={`flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-orange text-white shadow-[0_16px_40px_rgba(232,67,26,0.35)] transition-transform sm:h-16 sm:w-16 ${isDraggingFloatingButton ? 'scale-110 cursor-grabbing' : 'cursor-grab hover:scale-105'}`}
                    aria-label="Open chat"
                    title="短按打开，长按拖动位置"
                >
                    {open ? <X size={24} /> : (
                        <span className="relative h-full w-full overflow-hidden rounded-full border-2 border-orange/40 bg-[#fffaf5]">
                            <Image src="/ai-rental-bot.png" alt="Open YITU AI assistant" fill sizes="64px" className="object-cover p-0.5" />
                        </span>
                    )}
                    {!open && unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full bg-navy text-white text-[11px] font-bold flex items-center justify-center">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {open && (
                <div className="fixed inset-x-2 top-2 bottom-2 z-50 flex h-[calc(100dvh-16px)] max-h-[calc(100dvh-16px)] w-auto flex-col overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:inset-x-auto sm:bottom-24 sm:right-5 sm:top-auto sm:h-[680px] sm:max-h-[calc(100dvh-120px)] sm:w-[calc(100vw-24px)] sm:max-w-[420px] sm:rounded-[28px]">

                    {/* Header */}
                    <div className="bg-[linear-gradient(135deg,#0f2347_0%,#183a6d_100%)] px-5 py-4 text-white">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-white/70 font-bold">
                                {status === 'human' ? <Headset size={14} /> : <BellDot size={14} />}
                                {headerLabel}
                            </div>
                            <button
                                type="button"
                                onClick={toggleChat}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                                aria-label="Close chat"
                            >
                                <X size={17} />
                            </button>
                        </div>
                        <h3 className="font-syne text-[1.1rem] font-extrabold mt-1">YITU Car Rental</h3>
                        <div className="mt-0.5 flex items-center justify-between gap-3">
                            <p className="text-[12px] text-white/75">
                                {status === 'human'
                                    ? copy.connected
                                    : chatLocale === 'zh'
                                        ? '找车、选保险和附加项，都可以在这里完成。'
                                        : copy.assistantHint}
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowLanguageChoice(true)}
                                className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/85 transition-colors hover:bg-white/20"
                            >
                                {chatLocale === 'zh' ? '中文' : 'EN'}
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] px-4 py-4">
                        {showLanguageChoice && (
                            <LanguageChoiceCard locale={chatLocale} onChoose={chooseChatLanguage} />
                        )}

                        {showQuickFinder && (
                            <QuickFinderForm
                                value={quickFinder}
                                onChange={updates => setQuickFinder(current => ({ ...current, ...updates }))}
                                onSubmit={submitQuickFinder}
                                onDismiss={dismissQuickFinder}
                                sending={quickFinderLoading}
                                locale={chatLocale}
                            />
                        )}

                        {messages.map(msg => (
                            <div
                                key={`${msg.sender}-${msg.timestamp}-${msg.text}`}
                                className={`mb-3 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm whitespace-pre-line ${
                                        msg.sender === 'user'
                                            ? 'bg-orange text-white rounded-br-md'
                                            : 'bg-white border border-black/10 text-navy rounded-bl-md'
                                    }`}
                                >
                                    {msg.text}
                                    <div className={`mt-1 text-[10px] ${msg.sender === 'user' ? 'text-white/80' : 'text-muted'}`}>
                                        {formatTime(msg.timestamp)}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {showContextQuestions && (
                            <div className="mb-4 rounded-2xl border border-orange/20 bg-orange/[0.06] p-3 shadow-sm">
                                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-orange">
                                    {pageContext.title}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {pageContext.faqs.map((faq, index) => (
                                        <button
                                            key={`page-faq-${faq.question}-${index}`}
                                            onClick={() => handleFaqMessage(faq.question)}
                                            className="rounded-full border border-orange/25 bg-white px-3 py-1.5 text-left text-[11.5px] font-semibold text-navy transition-colors hover:border-orange/40 hover:bg-orange/10"
                                        >
                                            {faq.question}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {showCommonQuestions && (
                            <div className="mb-4 rounded-2xl border border-orange/15 bg-white/80 p-3 shadow-sm">
                                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                                    {copy.commonQuestions}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {faqs.slice(0, 8).map((faq, index) => (
                                        <button
                                            key={faq.id || `${faq.question}-${index}`}
                                            onClick={() => handleFaqMessage(faq.question)}
                                            className="rounded-full border border-orange/20 bg-orange/5 px-3 py-1.5 text-left text-[11.5px] font-semibold text-navy transition-colors hover:border-orange/40 hover:bg-orange/10"
                                        >
                                            {getChatFaqQuestion(faq, chatLocale)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {quickFinderSubmitted && (
                            <VehicleRecommendations
                                vehicles={recommendedVehicles}
                                onSearch={goToQuickSearch}
                                onSelect={selectRecommendedVehicle}
                                source={recommendationSource}
                                locale={chatLocale}
                            />
                        )}

                        {chatBooking && (
                            <ChatBookingPanel
                                state={chatBooking}
                                locale={chatLocale}
                                driverAge={storedBookingMeta.driverAge}
                                pickupTime={storedBookingMeta.pickupTime}
                                dropoffTime={storedBookingMeta.dropoffTime}
                                onChange={updates => setChatBooking(current => current ? ({ ...current, ...updates }) : current)}
                                onContinue={continueChatBooking}
                                onViewAll={goToQuickSearch}
                            />
                        )}

                        {showDriverDetails && (
                            <ChatDriverDetailsPanel
                                locale={chatLocale}
                                value={driverDetails}
                                errors={driverErrors}
                                onChange={updates => {
                                    setDriverDetails(current => ({ ...current, ...updates }))
                                    setDriverErrors(current => {
                                        const next = { ...current }
                                        for (const key of Object.keys(updates)) delete next[key]
                                        return next
                                    })
                                }}
                                onSubmit={submitDriverDetails}
                            />
                        )}

                        {showPaymentPanel && (
                            <ChatPaymentPanel
                                locale={chatLocale}
                                booking={paymentBooking}
                                paymentType={chatPaymentType}
                                onPaymentTypeChange={type => {
                                    setChatPaymentType(type)
                                    setChatPaymentClientSecret('')
                                    setChatPaymentReservation({ ref: '', no: '' })
                                    setChatPaymentError('')
                                }}
                                loading={chatPaymentLoading}
                                error={chatPaymentError}
                                onStartPayment={startChatPayment}
                                clientSecret={chatPaymentClientSecret}
                                reservation={chatPaymentReservation}
                            />
                        )}

                        {/* Contact form (inline in chat) */}
                        {showContactForm && (
                            <ContactForm
                                onSubmit={handleContactSubmit}
                                onCancel={() => setShowContactForm(false)}
                                sending={sending}
                                locale={chatLocale}
                            />
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input area */}
                    <div className="shrink-0 border-t border-black/10 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                        {error && <div className="mb-2 text-[12px] text-red-600">{error}</div>}

                        {/* Human support button (bot mode only) */}
                        {showSupportButton && (
                            <button
                                onClick={() => setShowContactForm(true)}
                                className="w-full mb-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-navy/20 bg-navy/5 py-2 text-[12px] font-bold text-navy hover:bg-navy/10 transition-colors"
                            >
                                <Headset size={13} /> {copy.contactHuman}
                            </button>
                        )}

                        <div className="flex items-end gap-2">
                            <textarea
                                rows={1}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder={showLanguageChoice ? copy.chooseLanguageFirst : status === 'human' ? copy.messageTeam : copy.askQuestion}
                                disabled={showLanguageChoice || sending}
                                className="min-h-[48px] flex-1 resize-none rounded-2xl border border-black/10 bg-off-white px-4 py-3 text-[13px] text-navy outline-none focus:border-orange"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSend()
                                    }
                                }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={showLanguageChoice || sending || !input.trim()}
                                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange text-white transition-colors hover:bg-orange-dark disabled:opacity-60"
                                aria-label="Send"
                            >
                                <SendHorizontal size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
