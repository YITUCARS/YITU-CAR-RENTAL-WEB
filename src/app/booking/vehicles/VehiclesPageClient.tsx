'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Users, Briefcase, ArrowRight, Search, SlidersHorizontal, Tag, Zap } from 'lucide-react'
import { useBooking, calcDays, calcAfterHourBreakdown, LOCATION_IDS } from '@/lib/booking-context'
import BookingFlowHeader from '@/components/booking/BookingFlowHeader'
import Navbar from '@/components/layout/Navbar'
import {
  toYMD, parseYMD, nextTimeSlot, getNZMinPickup, getNZDatePlusDays,
  DateTimePicker, LocationSelect, TimeSelect,
} from '@/components/booking/DateTimePicker'

interface RCMVehicle {
    vehiclecategoryid: number
    vehiclecategorytypeid: number
    vehiclecategory: string
    categoryfriendlydescription: string
    avgrate: number
    totalrateafterdiscount: number
    totaldiscountamount: number
    numberofdays: number
    numberofadults: number
    numberoflargecases: number
    numberofsmallcases: number
    imageurl: string
    available: number
    availablemessage: string
    nextAvailableDate?: string
    localFallback?: boolean
    localPricePerDay?: number
    localPricingPreview?: {
        avgrate?: number
        totalratebeforediscount?: number
        totalrateafterdiscount?: number
    }
    fuel?: string
    fueltype?: string
}

interface RCMCategoryType {
    id: number
    vehiclecategorytype: string
    displayorder?: number | string | null
}

type DriverAge = 'over26' | 'under26'

type SearchFormState = {
    pickupLocation: string
    dropoffLocation: string
    pickupDate: string
    pickupTime: string
    dropoffDate: string
    dropoffTime: string
    driverAge: DriverAge
}

const LOCATIONS = ['Christchurch', 'Queenstown', 'Auckland']
const ACTIVE_LOCATIONS = ['Christchurch', 'Queenstown']

const DROPOFF_RULES: Record<string, string[]> = {
    Christchurch: ['Christchurch', 'Queenstown'],
    Queenstown: ['Queenstown', 'Christchurch'],
    Auckland: ['Christchurch'],
}

const VEHICLES_COPY = {
    en: {
        refineSearch: 'Refine Search',
        adjustTrip: 'Adjust your trip and filters',
        pickupLocation: 'Pick-up Location',
        dropoffLocation: 'Drop-off Location',
        pickupDate: 'Pick-up Date',
        pickupTime: 'Pick-up Time',
        dropoffDate: 'Drop-off Date',
        dropoffTime: 'Drop-off Time',
        maxPriceDay: 'Max Price / Day',
        vehicleType: 'Vehicle Type',
        allTypes: 'All types',
        promoCode: 'Promo Code',
        enterPromoCode: 'Enter promo code',
        apply: 'Apply',
        promoHelp: 'Press Apply or Update Results to search with this code',
        driverAge: 'Driver Age',
        under26: 'Under 26',
        updateResults: 'Update Results',
        unappliedTitle: 'Search changes are not applied yet',
        unappliedBody: 'Click Update Results before selecting a vehicle so pricing and availability match the latest trip details.',
        pickup: 'Pick-up',
        dropoff: 'Drop-off',
        duration: 'Duration',
        day: 'day',
        days: 'days',
        vehicleGroupsAvailable: 'vehicle groups available',
        resultsHint: 'Results update from your new dates, times, locations, price cap, and vehicle type filter.',
        youngDriverFeeApplies: 'Young Driver Fee applies · +$30/day',
        noVehiclesAvailable: 'No vehicles available',
        noVehiclesAvailableBody: 'No vehicles are available for your selected dates and locations. Try adjusting your pick-up or drop-off times.',
        searchAgain: 'Search again',
        trySearchAgain: 'Try search again',
        noVehiclesMatch: 'No vehicles match these filters',
        noVehiclesMatchBody: 'Try increasing the max price or switching to another vehicle type.',
        noImage: 'No image',
        adults: 'Adults',
        largeSmallBags: (large: number, small: number) => `${large} Large + ${small} Small bags`,
        perDay: '/day',
        youngDriverFee: '+ Young Driver Fee',
        promoApplied: (code: string) => `Promo ${code} applied · save`,
        total: 'total',
        priceUnavailable: 'Price unavailable',
        updateResultsFirst: 'Update Results First',
        select: 'Select',
        bookingTimeNotice: 'Booking Time Notice',
        christchurchTiming: 'Bookings within 6 hours require staff confirmation. You can still submit a booking request and our team will contact you shortly.',
        otherTiming: 'Bookings within 24 hours require staff confirmation. You can still submit a booking request and our team will contact you shortly.',
        timingBody: 'Some vehicles may be unavailable for your selected dates. Please adjust your pick-up date and time and search again.',
        timingCta: 'Yes, I understand',
        close: 'Close',
        unavailableLoad: 'Unable to load available vehicles. Please try again.',
        networkError: 'Network error. Please try again.',
        electric: 'Electric vehicle',
        nextAvailable: 'Next available hire date',
        checkNextAvailable: 'Check next available date',
        useThisDate: 'Search this date',
        requestBooking: 'Request booking · staff confirmation',
        requestTitle: 'Request this vehicle',
        requestBody: 'This vehicle requires staff confirmation for your selected time. Leave your contact details and our team will confirm availability with you.',
        firstName: 'First name',
        lastName: 'Last name',
        email: 'Email',
        phone: 'Phone number',
        wechat: 'WeChat ID',
        optional: 'optional',
        submitRequest: 'Submit booking request',
        submittingRequest: 'Submitting…',
        requestSuccessTitle: 'Request submitted',
        requestSuccessBody: 'Thanks. Our team has received your request and will contact you shortly.',
        requestReference: 'Request reference',
    },
    zh: {
        refineSearch: '筛选搜索',
        adjustTrip: '调整行程和筛选条件',
        pickupLocation: '取车地点',
        dropoffLocation: '还车地点',
        pickupDate: '取车日期',
        pickupTime: '取车时间',
        dropoffDate: '还车日期',
        dropoffTime: '还车时间',
        maxPriceDay: '每日最高价格',
        vehicleType: '车辆类型',
        allTypes: '全部类型',
        promoCode: '优惠码',
        enterPromoCode: '输入优惠码',
        apply: '应用',
        promoHelp: '请点击“应用”或“更新结果”，使用该优惠码重新搜索',
        driverAge: '驾驶员年龄',
        under26: '26岁以下',
        updateResults: '更新结果',
        unappliedTitle: '搜索条件尚未应用',
        unappliedBody: '请选择车辆前先点击“更新结果”，确保价格和库存与最新行程一致。',
        pickup: '取车',
        dropoff: '还车',
        duration: '租期',
        day: '天',
        days: '天',
        vehicleGroupsAvailable: '组车型可预订',
        resultsHint: '结果会根据最新日期、时间、地点、价格上限和车型筛选更新。',
        youngDriverFeeApplies: '适用年轻驾驶员费用 · +$30/天',
        noVehiclesAvailable: '暂无可预订车辆',
        noVehiclesAvailableBody: '当前日期和地点暂无可订车辆，请尝试调整取车或还车时间。',
        searchAgain: '重新搜索',
        trySearchAgain: '再次搜索',
        noVehiclesMatch: '没有符合筛选条件的车辆',
        noVehiclesMatchBody: '请尝试提高价格上限，或切换其他车辆类型。',
        noImage: '暂无图片',
        adults: '位乘客',
        largeSmallBags: (large: number, small: number) => `${large} 个大箱 + ${small} 个小箱`,
        perDay: '/天',
        youngDriverFee: '+ 年轻驾驶员费',
        promoApplied: (code: string) => `优惠码 ${code} 已应用 · 共节省`,
        total: '总价',
        priceUnavailable: '价格暂不可用',
        updateResultsFirst: '请先更新结果',
        select: '选择',
        bookingTimeNotice: '预订时间提示',
        christchurchTiming: '距离取车少于 6 小时，需要人工确认。您仍可提交预订申请，我们的客服会尽快与您联系。',
        otherTiming: '距离取车少于 24 小时，需要人工确认。您仍可提交预订申请，我们的客服会尽快与您联系。',
        timingBody: '你选择的日期可能导致部分车辆不可预订，请调整取车日期和时间后重新搜索。',
        timingCta: '好的，我了解了',
        close: '关闭',
        unavailableLoad: '无法加载可预订车辆，请稍后再试。',
        networkError: '网络错误，请稍后再试。',
        electric: '电动车 EV',
        nextAvailable: '下一可租日期',
        checkNextAvailable: '查询下一可用日期',
        useThisDate: '用这个日期搜索',
        requestBooking: '申请预订，员工确认',
        requestTitle: '申请预订这台车',
        requestBody: '您选择的时间需要员工手动确认。请留下联系方式，我们的客服会确认车辆是否可用并联系您。',
        firstName: '名字',
        lastName: '姓氏',
        email: '邮箱',
        phone: '电话号码',
        wechat: '微信号',
        optional: '可选',
        submitRequest: '提交预订申请',
        submittingRequest: '提交中…',
        requestSuccessTitle: '申请已提交',
        requestSuccessBody: '感谢您，我们已收到申请，客服会尽快与您联系。',
        requestReference: '申请编号',
    },
} as const

const LOCATION_LABELS: Record<'en' | 'zh', Record<string, string>> = {
    en: {
        Christchurch: 'Christchurch',
        Queenstown: 'Queenstown',
        Auckland: 'Auckland',
    },
    zh: {
        Christchurch: '基督城',
        Queenstown: '皇后镇',
        Auckland: '奥克兰',
    },
}

function getVehicleCopy(locale: string) {
    return locale === 'zh' ? VEHICLES_COPY.zh : VEHICLES_COPY.en
}

function getLocationOptions(locale: string, locations: string[]) {
    const labels = locale === 'zh' ? LOCATION_LABELS.zh : LOCATION_LABELS.en
    return locations.map(location => ({
        value: location,
        label: labels[location] || location,
        disabled: !ACTIVE_LOCATIONS.includes(location),
        hint: !ACTIVE_LOCATIONS.includes(location) ? 'Coming soon' : '',
    }))
}

function getLocationLabel(locale: string, location: string) {
    const labels = locale === 'zh' ? LOCATION_LABELS.zh : LOCATION_LABELS.en
    return labels[location] || location
}

function getAvailabilityLabel(locale: string, message: string) {
    const normalized = message.trim().toLowerCase()
    if (normalized === 'request booking - human confirmation required') {
        return locale === 'zh' ? '申请预订，员工确认' : 'Request booking · staff confirmation'
    }
    if (locale !== 'zh') return message
    if (normalized === 'available') return '可预订'
    if (normalized === 'fully booked') return '已订满'
    if (normalized === 'unavailable for selected dates') return '所选日期不可订'
    return message
}

function sortCategoryTypes(types: RCMCategoryType[]) {
    return [...types].sort((a, b) => {
        const aOrder = Number(a.displayorder)
        const bOrder = Number(b.displayorder)
        const aHasOrder = Number.isFinite(aOrder) && a.displayorder !== '' && a.displayorder !== null
        const bHasOrder = Number.isFinite(bOrder) && b.displayorder !== '' && b.displayorder !== null

        if (aHasOrder && bHasOrder && aOrder !== bOrder) return aOrder - bOrder
        if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1
        return a.vehiclecategorytype.localeCompare(b.vehiclecategorytype)
    })
}

function getVehicleTypeLabel(vehicle: RCMVehicle, categoryTypeMap: Map<number, string>) {
    return categoryTypeMap.get(vehicle.vehiclecategorytypeid) || `Type ${vehicle.vehiclecategorytypeid}`
}

function normalizeAvailabilityStatus(vehicle: RCMVehicle) {
    return (vehicle.availablemessage || '').trim().toLowerCase()
}

function isVehicleSelectable(vehicle: RCMVehicle) {
    return normalizeAvailabilityStatus(vehicle) === 'available' || vehicle.available === 1
}

function getAvailabilityRank(vehicle: RCMVehicle) {
    const status = normalizeAvailabilityStatus(vehicle)
    if (status === 'available' || vehicle.available === 1) return 0
    if (status === 'fully booked') return 1
    if (status === 'unavailable for selected dates') return 2
    return 3
}

function isElectricVehicle(vehicle: RCMVehicle) {
    const text = `${vehicle.vehiclecategory} ${vehicle.categoryfriendlydescription} ${vehicle.fuel || ''} ${vehicle.fueltype || ''}`.toLowerCase()
    return /\bev\b|electric|tesla|model y|model 3|leaf|ioniq|byd/.test(text)
}

function shiftDate(value: string, days: number) {
    const date = new Date(`${value}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

function roundMoney(value: number) {
    return Math.round(value * 100) / 100
}

function PriceDisplay({ value }: { value: number }) {
    const fixed = value.toFixed(2)
    const [intPart, decPart] = fixed.split('.')
    return (
        <>
            {Number(intPart).toLocaleString()}
            <span style={{ fontSize: '0.5em' }}>.{decPart}</span>
        </>
    )
}

function getVehiclePricing(vehicle: RCMVehicle, days: number) {
    const safeDays = Math.max(days, 1)
    const cachedRate = Number(vehicle.localPricePerDay || vehicle.localPricingPreview?.avgrate || 0)
    const baseRatePerDay = roundMoney(vehicle.localFallback && cachedRate > 0
        ? cachedRate
        : Number(vehicle.avgrate) > 0 ? vehicle.avgrate : cachedRate)
    const baseTotal = roundMoney(baseRatePerDay * safeDays)

    let promoDiscount = 0
    // RCM can return an old total-rate field on short-notice fallback rows.
    // It is not a promo discount, so local request quotes must use the full
    // cached daily price multiplied by the rental days.
    if (vehicle.localFallback) {
        promoDiscount = 0
    } else if (vehicle.totaldiscountamount > 0) {
        promoDiscount = roundMoney(vehicle.totaldiscountamount)
    } else if (vehicle.totalrateafterdiscount > 0 && vehicle.totalrateafterdiscount < baseTotal) {
        promoDiscount = roundMoney(baseTotal - vehicle.totalrateafterdiscount)
    }

    const discountedTotal = roundMoney(baseTotal - promoDiscount)
    const effectivePerDay = roundMoney(discountedTotal / safeDays)
    return { baseTotal, promoDiscount, discountedTotal, effectivePerDay }
}

function VehicleSearchCard({
    form,
    setForm,
    onSearch,
    maxPrice,
    setMaxPrice,
    vehicleType,
    setVehicleType,
    vehicleTypeOptions,
    promoCode,
    setPromoCode,
    copy,
    locale,
    compact = false,
}: {
    form: SearchFormState
    setForm: React.Dispatch<React.SetStateAction<SearchFormState>>
    onSearch: () => void
    maxPrice: number
    setMaxPrice: (value: number) => void
    vehicleType: string
    setVehicleType: (value: string) => void
    vehicleTypeOptions: RCMCategoryType[]
    promoCode: string
    setPromoCode: (value: string) => void
    copy: typeof VEHICLES_COPY.en | typeof VEHICLES_COPY.zh
    locale: string
    compact?: boolean
}) {
    const allowedDropoffs = DROPOFF_RULES[form.pickupLocation] || LOCATIONS
    const locationOptions = getLocationOptions(locale, LOCATIONS)
    const dropoffOptions = [
        ...getLocationOptions(locale, allowedDropoffs),
        ...getLocationOptions(locale, LOCATIONS.filter(location => !allowedDropoffs.includes(location))).map(option => ({
            ...option,
            disabled: true,
            hint: option.hint || 'Coming soon',
        })),
    ]
    const nzMin = getNZMinPickup()
    const sameDay = form.pickupDate === form.dropoffDate
    const pickupMinTime = form.pickupDate === nzMin.minDate ? nzMin.minHour : undefined
    const dropoffMinTime = sameDay ? form.pickupTime : undefined

    function updateField<K extends keyof SearchFormState>(field: K, value: SearchFormState[K]) {
        if ((field === 'pickupLocation' || field === 'dropoffLocation') && !ACTIVE_LOCATIONS.includes(value as string)) return

        setForm(current => {
            const next = { ...current, [field]: value }

            if (field === 'pickupLocation') {
                const validDropoffs = DROPOFF_RULES[value as string] || LOCATIONS
                if (!validDropoffs.includes(next.dropoffLocation)) {
                    next.dropoffLocation = validDropoffs[0]
                }
            }

            if (field === 'pickupDate' && next.dropoffDate && next.dropoffDate < next.pickupDate) {
                const nextDropoff = parseYMD(next.pickupDate)
                nextDropoff.setDate(nextDropoff.getDate() + 1)
                next.dropoffDate = toYMD(nextDropoff)
            }

            if ((field === 'pickupDate' || field === 'pickupTime') && next.pickupDate === next.dropoffDate && next.dropoffTime <= next.pickupTime) {
                next.dropoffTime = nextTimeSlot(next.pickupTime)
            }

            if (field === 'dropoffDate' && next.pickupDate === next.dropoffDate && next.dropoffTime <= next.pickupTime) {
                next.dropoffTime = nextTimeSlot(next.pickupTime)
            }

            return next
        })
    }

    return (
        <div className={`rounded-[28px] border border-black/10 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] ${compact ? 'p-3' : 'p-5'}`}>
            <div className={`flex items-center justify-between gap-3 ${compact ? 'mb-2' : 'mb-5'}`}>
                <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted font-bold">{copy.refineSearch}</div>
                    <h3 className={`font-syne text-navy ${compact ? 'text-[1rem] font-bold' : 'text-[1.1rem] font-extrabold'}`}>
                        {copy.adjustTrip}
                    </h3>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-orange/10 flex items-center justify-center flex-shrink-0">
                    <SlidersHorizontal size={18} className="text-orange" />
                </div>
            </div>

            {/* ── Location fields ── */}
            <div className={`grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-1 sm:grid-cols-2 gap-3'} ${compact ? '' : 'mb-3'}`}>
                <LocationSelect
                    label={copy.pickupLocation}
                    value={form.pickupLocation}
                    options={locationOptions}
                    onChange={v => updateField('pickupLocation', v)}
                />
                <LocationSelect
                    label={copy.dropoffLocation}
                    value={form.dropoffLocation}
                    options={dropoffOptions}
                    onChange={v => updateField('dropoffLocation', v)}
                />
            </div>

            {/* ── Date/Time fields ── */}
            <div className={`grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-2 xl:grid-cols-4 gap-3'}`}>
                <DateTimePicker
                    label={copy.pickupDate}
                    value={form.pickupDate}
                    rangeEnd={form.dropoffDate}
                    time={form.pickupTime}
                    minDate={nzMin.minDate}
                    minTime={pickupMinTime}
                    onChange={d => updateField('pickupDate', d)}
                    onRangeEndChange={d => updateField('dropoffDate', d)}
                    onTimeChange={t => updateField('pickupTime', t)}
                    timeLabel={copy.pickupTime}
                    showTime={false}
                    enableRangeSelection
                />
                <TimeSelect
                    label={copy.pickupTime}
                    value={form.pickupTime}
                    minTime={pickupMinTime}
                    onChange={t => updateField('pickupTime', t)}
                />
                <DateTimePicker
                    label={copy.dropoffDate}
                    value={form.dropoffDate}
                    time={form.dropoffTime}
                    minDate={form.pickupDate || nzMin.minDate}
                    minTime={dropoffMinTime}
                    onChange={d => updateField('dropoffDate', d)}
                    onTimeChange={t => updateField('dropoffTime', t)}
                    timeLabel={copy.dropoffTime}
                    showTime={false}
                />
                <TimeSelect
                    label={copy.dropoffTime}
                    value={form.dropoffTime}
                    minTime={dropoffMinTime}
                    onChange={t => updateField('dropoffTime', t)}
                />
            </div>

            {/* ── Filters row ── */}
            <div className={`${compact ? 'mt-2' : 'mt-4'} grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-1 xl:grid-cols-4 gap-4'} items-end`}>
                <div>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="text-[10.5px] text-muted uppercase tracking-[0.14em] font-bold">{copy.maxPriceDay}</span>
                        <span className="text-[12px] font-semibold text-orange">${maxPrice}</span>
                    </div>
                    <input
                        type="range"
                        min={60}
                        max={1000}
                        step={10}
                        value={maxPrice}
                        onChange={e => setMaxPrice(Number(e.target.value))}
                        className="w-full accent-orange"
                    />
                </div>

                <label className="block">
                    <span className="text-[10.5px] text-muted uppercase tracking-[0.14em] font-bold mb-1.5 block">{copy.vehicleType}</span>
                    <select
                        value={vehicleType}
                        onChange={e => setVehicleType(e.target.value)}
                        className={`w-full rounded-xl border border-black/10 bg-off-white px-4 ${compact ? 'py-2' : 'py-3'} text-[14px] text-navy outline-none focus:border-orange`}
                    >
                        <option value="all">{copy.allTypes}</option>
                        {vehicleTypeOptions.map(option => (
                            <option key={option.id} value={String(option.id)}>
                                {option.vehiclecategorytype}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <span className="flex items-center gap-1.5 text-[10.5px] text-muted uppercase tracking-[0.14em] font-bold mb-1.5">
                        <Tag size={11} className="text-orange" /> {copy.promoCode}
                    </span>
                    <div className={`rounded-xl border border-black/10 bg-off-white px-4 ${compact ? 'py-2' : 'py-3'} flex items-center gap-2`}>
                        <input
                            type="text"
                            value={promoCode}
                            onChange={e => setPromoCode(e.target.value.toUpperCase())}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSearch() } }}
                            placeholder={copy.enterPromoCode}
                            className="flex-1 bg-transparent text-[14px] font-semibold tracking-[0.14em] text-navy outline-none placeholder:text-muted/55"
                        />
                        {promoCode && (
                            <button
                                type="button"
                                onClick={onSearch}
                                className="text-[11px] font-bold text-white bg-orange hover:bg-orange-dark px-3 py-1 rounded-lg transition-colors whitespace-nowrap"
                            >
                                {copy.apply}
                            </button>
                        )}
                    </div>
                    {promoCode && (
                        <div className="mt-1.5 text-[11px] text-muted">
                            {copy.promoHelp}
                        </div>
                    )}
                </label>

                <div className={`${compact ? '' : 'xl:min-w-[170px]'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10.5px] text-muted uppercase tracking-[0.14em] font-bold">{copy.driverAge}</span>
                    </div>
                    <div className={`flex gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
                        <button
                            onClick={() => updateField('driverAge', 'over26')}
                            className={`flex-1 rounded-xl border px-3 ${compact ? 'py-1.5' : 'py-2'} text-[12px] font-syne font-bold transition-all ${
                                form.driverAge === 'over26'
                                    ? 'bg-orange border-orange text-white'
                                    : 'border-black/10 text-muted hover:border-orange hover:text-orange'
                            }`}
                        >
                            26+
                        </button>
                        <button
                            onClick={() => updateField('driverAge', 'under26')}
                            className={`flex-1 rounded-xl border px-3 ${compact ? 'py-1.5' : 'py-2'} text-[12px] font-syne font-bold transition-all ${
                                form.driverAge === 'under26'
                                    ? 'bg-orange border-orange text-white'
                                    : 'border-black/10 text-muted hover:border-orange hover:text-orange'
                            }`}
                        >
                            {copy.under26}
                        </button>
                    </div>
                    <button
                        onClick={onSearch}
                        className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[14px] px-5 ${compact ? 'py-2' : 'py-3'} shadow-orange-glow transition-all`}
                    >
                        <Search size={16} /> {copy.updateResults}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function VehiclesPage() {
    const router = useRouter()
    const params = useSearchParams()
    const locale = useLocale()
    const copy = getVehicleCopy(locale)
    const { booking, setBooking, isHydrated } = useBooking()

    const requestedPickupLocation = params.get('pickupLocation') || 'Christchurch'
    const initialPickupLocation = ACTIVE_LOCATIONS.includes(requestedPickupLocation) ? requestedPickupLocation : 'Christchurch'
    const requestedDropoffLocation = params.get('dropoffLocation') || 'Christchurch'
    const validInitialDropoffs = DROPOFF_RULES[initialPickupLocation] || ACTIVE_LOCATIONS
    const initialDropoffLocation = validInitialDropoffs.includes(requestedDropoffLocation) ? requestedDropoffLocation : validInitialDropoffs[0]
    const initialPickupDate = params.get('pickupDate') || ''
    const initialPickupTime = params.get('pickupTime') || '10:00'
    const initialDropoffDate = params.get('dropoffDate') || ''
    const initialDropoffTime = params.get('dropoffTime') || '10:00'
    const initialDriverAge = (params.get('driverAge') as DriverAge) || 'over26'
    const initialPromoCode = params.get('promoCode') || ''

    const [searchForm, setSearchForm] = useState<SearchFormState>({
        pickupLocation: initialPickupLocation,
        dropoffLocation: initialDropoffLocation,
        pickupDate: initialPickupDate,
        pickupTime: initialPickupTime,
        dropoffDate: initialDropoffDate,
        dropoffTime: initialDropoffTime,
        driverAge: initialDriverAge,
    })

    const [vehicles, setVehicles] = useState<RCMVehicle[]>([])
    const [searchResults, setSearchResults] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [maxPrice, setMaxPrice] = useState(1000)
    const [vehicleType, setVehicleType] = useState('all')
    const [showStickySearch, setShowStickySearch] = useState(false)
    const [promoCode, setPromoCode] = useState(initialPromoCode.toUpperCase())
    const [showTimingModal, setShowTimingModal] = useState(false)
    const [appliedSearchForm, setAppliedSearchForm] = useState<SearchFormState>(searchForm)
    const [appliedPromoCode, setAppliedPromoCode] = useState(initialPromoCode.toUpperCase())
    const [nextAvailabilityLoading, setNextAvailabilityLoading] = useState<Record<string, boolean>>({})
    const [requestVehicle, setRequestVehicle] = useState<RCMVehicle | null>(null)
    const [requestForm, setRequestForm] = useState({ firstName: '', lastName: '', email: '', phone: '', wechat: '' })
    const [requestSubmitting, setRequestSubmitting] = useState(false)
    const [requestError, setRequestError] = useState('')
    const [requestSuccessRef, setRequestSuccessRef] = useState('')

    const days = calcDays(appliedSearchForm.pickupDate, appliedSearchForm.pickupTime, appliedSearchForm.dropoffDate, appliedSearchForm.dropoffTime)
    const hasUnappliedSearchChanges =
        searchForm.pickupLocation !== appliedSearchForm.pickupLocation ||
        searchForm.dropoffLocation !== appliedSearchForm.dropoffLocation ||
        searchForm.pickupDate !== appliedSearchForm.pickupDate ||
        searchForm.pickupTime !== appliedSearchForm.pickupTime ||
        searchForm.dropoffDate !== appliedSearchForm.dropoffDate ||
        searchForm.dropoffTime !== appliedSearchForm.dropoffTime ||
        searchForm.driverAge !== appliedSearchForm.driverAge ||
        promoCode.trim().toUpperCase() !== appliedPromoCode

    useEffect(() => {
        function onScroll() {
            setShowStickySearch(window.scrollY > 560)
        }

        onScroll()
        window.addEventListener('scroll', onScroll)
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    async function loadVehicles(form: SearchFormState, promoOverride?: string) {
        setLoading(true)
        setError('')

        const activePromoCode = (promoOverride ?? promoCode).trim().toUpperCase()
        const nextDays = calcDays(form.pickupDate, form.pickupTime, form.dropoffDate, form.dropoffTime)
        const isNewSearch =
            form.pickupDate !== booking.pickupDate ||
            form.dropoffDate !== booking.dropoffDate ||
            form.pickupLocation !== booking.pickupLocation ||
            form.dropoffLocation !== booking.dropoffLocation ||
            form.pickupTime !== booking.pickupTime ||
            form.dropoffTime !== booking.dropoffTime ||
            form.driverAge !== booking.driverAge

        setBooking(current => ({
            ...current,
            pickupLocation: form.pickupLocation,
            pickupLocationId: LOCATION_IDS[form.pickupLocation] || 1,
            dropoffLocation: form.dropoffLocation,
            dropoffLocationId: LOCATION_IDS[form.dropoffLocation] || 1,
            pickupDate: form.pickupDate,
            pickupTime: form.pickupTime,
            dropoffDate: form.dropoffDate,
            dropoffTime: form.dropoffTime,
            days: nextDays,
            afterHourFee: calcAfterHourBreakdown(form.pickupTime, form.dropoffTime).total,
            driverAge: form.driverAge,
            promoCode: activePromoCode,
            promoDiscountType: '',
            promoDiscountValue: 0,
            promoDiscountAmount: 0,
            ...(isNewSearch ? {
                vehicleId: '',
                vehicleName: '',
                basePricePerDay: 0,
                pricePerDay: 0,
                insuranceOptions: [],
                selectedInsuranceId: null,
                extras: {},
                reservationRef: '',
            } : {}),
        }))

        try {
            const response = await fetch('/api/rcm/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pickupLocation: form.pickupLocation,
                    dropoffLocation: form.dropoffLocation,
                    pickupDate: form.pickupDate,
                    dropoffDate: form.dropoffDate,
                    pickupTime: form.pickupTime,
                    dropoffTime: form.dropoffTime,
                    promoCode: activePromoCode,
                }),
            })

            const result = await response.json()
            if (result.success && result.data?.availablecars) {
                const cars: RCMVehicle[] = result.data.availablecars
                setVehicles(cars)
                setSearchResults(result.data)
                setAppliedSearchForm(form)
                setAppliedPromoCode(activePromoCode)
                const pickupMs = new Date(`${form.pickupDate}T${form.pickupTime}:00`).getTime()
                const hoursUntilPickup = (pickupMs - Date.now()) / 36e5
                const minHours = form.pickupLocation === 'Christchurch' ? 6 : 24
                if (hoursUntilPickup < minHours) setShowTimingModal(true)
                const query = new URLSearchParams({
                    pickupLocation: form.pickupLocation,
                    dropoffLocation: form.dropoffLocation,
                    pickupDate: form.pickupDate,
                    pickupTime: form.pickupTime,
                    dropoffDate: form.dropoffDate,
                    dropoffTime: form.dropoffTime,
                    driverAge: form.driverAge,
                })
                if (activePromoCode) query.set('promoCode', activePromoCode)
                const newSearch = `?${query.toString()}`
                if (window.location.search !== newSearch) {
                    window.history.replaceState(null, '', `/${locale}/booking/vehicles${newSearch}`)
                }
            } else {
                setVehicles([])
                setSearchResults(null)
                setError(result.error || copy.unavailableLoad)
            }
        } catch (error) {
            console.error('Vehicle search request failed:', error)
            setVehicles([])
            setSearchResults(null)
            setError(copy.networkError)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!isHydrated) return

        const hydratedPickupLocation = ACTIVE_LOCATIONS.includes(params.get('pickupLocation') || booking.pickupLocation)
            ? params.get('pickupLocation') || booking.pickupLocation
            : 'Christchurch'
        const hydratedDropoffRules = DROPOFF_RULES[hydratedPickupLocation] || ACTIVE_LOCATIONS
        const requestedHydratedDropoff = params.get('dropoffLocation') || booking.dropoffLocation || hydratedPickupLocation
        const hydratedDropoffLocation = hydratedDropoffRules.includes(requestedHydratedDropoff)
            ? requestedHydratedDropoff
            : hydratedDropoffRules[0]
        const nextPromoCode = (params.get('promoCode') || booking.promoCode || '').toUpperCase()
        const nextSearchForm: SearchFormState = {
            pickupLocation: hydratedPickupLocation,
            dropoffLocation: hydratedDropoffLocation,
            pickupDate: params.get('pickupDate') || booking.pickupDate || getNZDatePlusDays(2),
            pickupTime: params.get('pickupTime') || booking.pickupTime || '10:00',
            dropoffDate: params.get('dropoffDate') || booking.dropoffDate || getNZDatePlusDays(9),
            dropoffTime: params.get('dropoffTime') || booking.dropoffTime || '10:00',
            driverAge: (params.get('driverAge') as DriverAge) || booking.driverAge || 'over26',
        }

        setSearchForm(nextSearchForm)
        setAppliedSearchForm(nextSearchForm)
        setPromoCode(nextPromoCode)
        setAppliedPromoCode(nextPromoCode)
        loadVehicles(nextSearchForm, nextPromoCode)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHydrated])

    const vehicleTypeOptions = useMemo(() => {
        const availableTypeIds = new Set(vehicles.map(vehicle => vehicle.vehiclecategorytypeid))
        const categoryTypes = Array.isArray(searchResults?.categorytypes) ? searchResults.categorytypes as RCMCategoryType[] : []
        return sortCategoryTypes(categoryTypes).filter(type => availableTypeIds.has(type.id))
    }, [searchResults, vehicles])

    const vehicleTypeMap = useMemo(() => {
        return new Map(vehicleTypeOptions.map(type => [type.id, type.vehiclecategorytype]))
    }, [vehicleTypeOptions])

    useEffect(() => {
        if (vehicleType !== 'all' && !vehicleTypeOptions.some(option => String(option.id) === vehicleType)) {
            setVehicleType('all')
        }
    }, [vehicleType, vehicleTypeOptions])

    const filteredVehicles = useMemo(() => {
        return vehicles
            .filter(vehicle => {
                const pricing = getVehiclePricing(vehicle, days)
                const matchesType = vehicleType === 'all' || String(vehicle.vehiclecategorytypeid) === vehicleType
                const matchesPrice = pricing.effectivePerDay <= maxPrice
                return matchesType && matchesPrice
            })
            .sort((a, b) => {
                const electricDiff = Number(isElectricVehicle(b) && isVehicleSelectable(b)) - Number(isElectricVehicle(a) && isVehicleSelectable(a))
                if (electricDiff !== 0) return electricDiff
                const rankDiff = getAvailabilityRank(a) - getAvailabilityRank(b)
                if (rankDiff !== 0) return rankDiff

                const priceDiff = getVehiclePricing(a, days).effectivePerDay - getVehiclePricing(b, days).effectivePerDay
                if (priceDiff !== 0) return priceDiff

                return (a.categoryfriendlydescription || a.vehiclecategory).localeCompare(
                    b.categoryfriendlydescription || b.vehiclecategory
                )
            })
    }, [vehicles, vehicleType, maxPrice, days])

    function selectVehicle(vehicle: RCMVehicle) {
        if (hasUnappliedSearchChanges) return
        if (!isVehicleSelectable(vehicle)) return

        const pricing = getVehiclePricing(vehicle, days)
        const vehicleInsurance = (searchResults?.insuranceoptions || [])
            .filter((ins: any) => ins.vehiclecategoryid === vehicle.vehiclecategoryid)
            .filter((ins: any, idx: number, arr: any[]) =>
                arr.findIndex((entry: any) => entry.id === ins.id) === idx
            )

        setBooking(current => ({
            ...current,
            vehicleId: String(vehicle.vehiclecategoryid),
            vehicleCategoryTypeId: vehicle.vehiclecategorytypeid,
            vehicleName: vehicle.categoryfriendlydescription || vehicle.vehiclecategory,
            basePricePerDay: vehicle.avgrate,
            pricePerDay: pricing.effectivePerDay,
            days,
            promoCode: appliedPromoCode,
            promoDiscountType: '',
            promoDiscountValue: 0,
            promoDiscountAmount: pricing.promoDiscount,
            insuranceOptions: vehicleInsurance,
            selectedInsuranceId: vehicleInsurance.find((item: any) => item.isdefault)?.id ?? null,
        }))

        router.push(`/${locale}/booking/extras`)
    }

    function openManualRequest(vehicle: RCMVehicle) {
        setRequestVehicle(vehicle)
        setRequestForm({ firstName: '', lastName: '', email: '', phone: '', wechat: '' })
        setRequestError('')
        setRequestSuccessRef('')
    }

    async function submitManualRequest() {
        if (!requestVehicle) return
        if (!requestForm.firstName.trim() || !requestForm.lastName.trim() || !requestForm.email.trim() || !requestForm.phone.trim()) {
            setRequestError(locale === 'zh' ? '请填写所有联系信息。' : 'Please complete all contact fields.')
            return
        }

        setRequestSubmitting(true)
        setRequestError('')
        const pricing = getVehiclePricing(requestVehicle, days)
        try {
            const response = await fetch('/api/booking/manual-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                                        ...requestForm,
                    pickupDate: appliedSearchForm.pickupDate,
                    pickupTime: appliedSearchForm.pickupTime,
                    dropoffDate: appliedSearchForm.dropoffDate,
                    dropoffTime: appliedSearchForm.dropoffTime,
                    pickupLocation: appliedSearchForm.pickupLocation,
                    dropoffLocation: appliedSearchForm.dropoffLocation,
                    vehicleName: requestVehicle.categoryfriendlydescription || requestVehicle.vehiclecategory,
                    total: pricing.discountedTotal,
                }),
            })
            const result = await response.json()
            if (!response.ok || !result.success) throw new Error(result.error || 'Unable to submit booking request.')
            setRequestSuccessRef(result.requestRef || '')
            window.dispatchEvent(new CustomEvent('yitu:manual-request-success', {
                detail: { requestRef: result.requestRef || '' },
            }))
        } catch (error) {
            setRequestError(error instanceof Error ? error.message : (locale === 'zh' ? '提交失败，请稍后再试。' : 'Unable to submit. Please try again.'))
        } finally {
            setRequestSubmitting(false)
        }
    }

    async function lookupNextAvailableDate(vehicle: RCMVehicle) {
        const id = String(vehicle.vehiclecategoryid)
        setNextAvailabilityLoading(current => ({ ...current, [id]: true }))
        try {
            const response = await fetch('/api/rcm/next-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pickupLocation: appliedSearchForm.pickupLocation,
                    dropoffLocation: appliedSearchForm.dropoffLocation,
                    pickupDate: appliedSearchForm.pickupDate,
                    pickupTime: appliedSearchForm.pickupTime,
                    dropoffDate: appliedSearchForm.dropoffDate,
                    dropoffTime: appliedSearchForm.dropoffTime,
                    promoCode: appliedPromoCode,
                    vehicleIds: [vehicle.vehiclecategoryid],
                }),
            })
            const result = await response.json()
            if (result.success) {
                setVehicles(current => current.map(item => item.vehiclecategoryid === vehicle.vehiclecategoryid
                    ? { ...item, nextAvailableDate: result.dates?.[id] || '' }
                    : item))
            }
        } finally {
            setNextAvailabilityLoading(current => ({ ...current, [id]: false }))
        }
    }

    function useNextAvailableDate(vehicle: RCMVehicle) {
        if (!vehicle.nextAvailableDate) return
        const offset = Math.max(0, Math.round((new Date(`${vehicle.nextAvailableDate}T12:00:00Z`).getTime() - new Date(`${appliedSearchForm.pickupDate}T12:00:00Z`).getTime()) / 86400000))
        const nextForm = { ...appliedSearchForm, pickupDate: vehicle.nextAvailableDate, dropoffDate: shiftDate(appliedSearchForm.dropoffDate, offset) }
        setSearchForm(nextForm)
        loadVehicles(nextForm, appliedPromoCode)
    }

    return (
        <>
            <Navbar onManageBooking={() => {}} />

            <BookingFlowHeader
                current={2}
                onBack={() => router.push('/#booking')}
                summary={
                    <div className="flex flex-wrap gap-6 text-[13px] text-muted">
                        <div>
                            <span className="block text-[10px] uppercase tracking-wider mb-0.5 text-muted/70">{copy.pickup}</span>
                            <span className="font-semibold text-navy">{getLocationLabel(locale, appliedSearchForm.pickupLocation)} · {appliedSearchForm.pickupDate} {appliedSearchForm.pickupTime}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase tracking-wider mb-0.5 text-muted/70">{copy.dropoff}</span>
                            <span className="font-semibold text-navy">{getLocationLabel(locale, appliedSearchForm.dropoffLocation)} · {appliedSearchForm.dropoffDate} {appliedSearchForm.dropoffTime}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase tracking-wider mb-0.5 text-muted/70">{copy.duration}</span>
                            <span className="font-semibold text-orange">{days} {days === 1 ? copy.day : copy.days}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase tracking-wider mb-0.5 text-muted/70">{copy.driverAge}</span>
                            <span className={`font-semibold ${appliedSearchForm.driverAge === 'under26' ? 'text-orange' : 'text-navy'}`}>
                                {appliedSearchForm.driverAge === 'under26' ? copy.under26 : '26+'}
                            </span>
                        </div>
                    </div>
                }
            />

            <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10">
                <VehicleSearchCard
                    form={searchForm}
                    setForm={setSearchForm}
                    onSearch={() => loadVehicles(searchForm)}
                    maxPrice={maxPrice}
                    setMaxPrice={setMaxPrice}
                    vehicleType={vehicleType}
                    setVehicleType={setVehicleType}
                    vehicleTypeOptions={vehicleTypeOptions}
                    promoCode={promoCode}
                    setPromoCode={setPromoCode}
                    copy={copy}
                    locale={locale}
                />

                {hasUnappliedSearchChanges && (
                    <div className="mt-4 rounded-2xl border border-orange/30 bg-orange/10 px-5 py-4 text-[13px] text-navy flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <div className="font-syne font-bold">{copy.unappliedTitle}</div>
                            <div className="text-muted mt-0.5">
                                {copy.unappliedBody}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => loadVehicles(searchForm)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-4 py-2 transition-all"
                        >
                            <Search size={15} /> {copy.updateResults}
                        </button>
                    </div>
                )}

                <div className="mt-8 grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)] gap-8 items-start">
                    <aside className="hidden lg:block" aria-hidden="true">
                        <div className="h-[1px]" />
                    </aside>

                    <section>
                        {loading && (
                            <div className="flex flex-col gap-4">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="bg-white border border-black/10 rounded-card overflow-hidden flex flex-col sm:flex-row animate-pulse">
                                        <div className="sm:w-56 flex-shrink-0 bg-gray-200 aspect-[5/3] sm:aspect-[5/3]" />
                                        <div className="flex-1 p-6 flex flex-col justify-between gap-4">
                                            <div>
                                                <div className="flex gap-2 mb-3">
                                                    <div className="h-3 bg-gray-200 rounded w-24" />
                                                    <div className="h-3 bg-gray-200 rounded w-12" />
                                                </div>
                                                <div className="h-6 bg-gray-200 rounded w-2/3 mb-3" />
                                                <div className="flex gap-4">
                                                    <div className="h-3 bg-gray-200 rounded w-20" />
                                                    <div className="h-3 bg-gray-200 rounded w-28" />
                                                </div>
                                            </div>
                                            <div className="flex items-end justify-between pt-4 border-t border-black/[0.07]">
                                                <div>
                                                    <div className="h-3 bg-gray-200 rounded w-36 mb-2" />
                                                    <div className="h-8 bg-gray-200 rounded w-28" />
                                                </div>
                                                <div className="h-10 bg-gray-200 rounded-xl w-24" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {error && (
                            <div className="text-center py-20 text-muted">
                                <p>{error}</p>
                                <button onClick={() => loadVehicles(searchForm)} className="mt-4 text-orange underline text-sm">
                                    {copy.trySearchAgain}
                                </button>
                            </div>
                        )}

                        {!loading && !error && (
                            <>
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                                    <div>
                                        <h2 className="font-syne font-bold text-navy text-xl">
                                            {filteredVehicles.length} {copy.vehicleGroupsAvailable}
                                        </h2>
                                        <p className="text-[13px] text-muted mt-1">
                                            {copy.resultsHint}
                                        </p>
                                    </div>
                                    {appliedSearchForm.driverAge === 'under26' && (
                                        <span className="text-[12px] bg-orange/10 text-orange font-semibold px-3 py-1.5 rounded-full">
                                            {copy.youngDriverFeeApplies}
                                        </span>
                                    )}
                                </div>

                                {vehicles.length === 0 ? (
                                    <div className="bg-white border border-black/10 rounded-card p-8 text-center">
                                        <h3 className="font-syne font-bold text-navy text-lg">{copy.noVehiclesAvailable}</h3>
                                        <p className="text-muted text-[14px] mt-2">
                                            {copy.noVehiclesAvailableBody}
                                        </p>
                                        <button
                                            onClick={() => loadVehicles(searchForm)}
                                            className="mt-4 text-orange underline text-sm"
                                        >
                                            {copy.searchAgain}
                                        </button>
                                    </div>
                                ) : filteredVehicles.length === 0 ? (
                                    <div className="bg-white border border-black/10 rounded-card p-8 text-center">
                                        <h3 className="font-syne font-bold text-navy text-lg">{copy.noVehiclesMatch}</h3>
                                        <p className="text-muted text-[14px] mt-2">
                                            {copy.noVehiclesMatchBody}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {filteredVehicles.map(vehicle => {
                                            const pricing = getVehiclePricing(vehicle, days)
                                            const selectable = isVehicleSelectable(vehicle)
                                            const requestable = !selectable && pricing.effectivePerDay > 0
                                            const electric = isElectricVehicle(vehicle)
                                            return (
                                            <div
                                                key={vehicle.vehiclecategoryid}
                                                className={`border rounded-card overflow-hidden flex flex-col sm:flex-row hover:shadow-card transition-all ${electric && selectable ? 'border-emerald-300 bg-white shadow-[0_8px_24px_rgba(16,185,129,0.08)]' : 'bg-white border-black/10 hover:border-orange/30'}`}
                                            >
                                                <div className="sm:w-56 flex-shrink-0 bg-white flex items-center justify-center sm:self-stretch min-h-[160px]">
                                                    {vehicle.imageurl ? (
                                                        <img
                                                            src={vehicle.imageurl.startsWith('//') ? `https:${vehicle.imageurl}` : vehicle.imageurl}
                                                            alt={vehicle.vehiclecategory}
                                                            className="w-full h-full object-contain"
                                                            style={{ objectPosition: '50% 50%' }}
                                                        />
                                                    ) : (
                                                        <div className="w-full py-12 flex items-center justify-center text-muted text-sm">
                                                            {copy.noImage}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex-1 p-6 flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                                            <div className="text-[10.5px] text-muted uppercase tracking-wide">
                                                                {vehicle.vehiclecategory}
                                                            </div>
                                                            <span className="text-[10px] rounded-full bg-sky-50 text-sky-700 px-2.5 py-1 font-bold uppercase tracking-[0.14em]">
                                                                {getVehicleTypeLabel(vehicle, vehicleTypeMap)}
                                                            </span>
                                                            {electric && selectable && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white"><Zap size={11} /> {copy.electric}</span>}
                                                        </div>
                                                        <h3 className="font-syne font-bold text-xl text-navy mb-3">
                                                            {vehicle.categoryfriendlydescription || vehicle.vehiclecategory}
                                                        </h3>
                                                        <div className="flex gap-4 flex-wrap mb-3">
                                                            <span className="flex items-center gap-1.5 text-[13px] text-muted">
                                                                <Users size={13} className="text-orange" />
                                                                {vehicle.numberofadults} {copy.adults}
                                                            </span>
                                                            <span className="flex items-center gap-1.5 text-[13px] text-muted">
                                                                <Briefcase size={13} className="text-orange" />
                                                                {copy.largeSmallBags(vehicle.numberoflargecases, vehicle.numberofsmallcases)}
                                                            </span>
                                                        </div>
                                                        {vehicle.availablemessage && (
                                                            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                                                                selectable ? 'bg-green-50 text-green-700' : 'bg-orange/10 text-orange'
                                                            }`}>
                                                                {getAvailabilityLabel(locale, vehicle.availablemessage)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-end justify-between mt-5 pt-4 border-t border-black/[0.07] gap-4">
                                                        <div>
                                                            {selectable ? (
                                                                <>
                                                                    <div className="text-[16px] text-muted mb-0.5">
                                                                        $<PriceDisplay value={pricing.effectivePerDay} />{copy.perDay} × {days} {days === 1 ? copy.day : copy.days}
                                                                        {appliedSearchForm.driverAge === 'under26' && (
                                                                            <span className="text-orange ml-1">{copy.youngDriverFee}</span>
                                                                        )}
                                                                    </div>
                                                                    {pricing.promoDiscount > 0 && (
                                                                        <div className="text-[11px] text-green-700 font-medium mb-1">
                                                                            {copy.promoApplied(appliedPromoCode)} $<PriceDisplay value={pricing.promoDiscount} /> {copy.total}
                                                                        </div>
                                                                    )}
                                                                    <div className="font-syne font-extrabold text-[1.8rem] text-navy leading-none">
                                                                        <span className="text-[13px] font-bold">NZD</span>&nbsp;$<PriceDisplay value={pricing.discountedTotal} />
                                                                        <span className="text-[13px] font-normal text-muted ml-1">{copy.total}</span>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {requestable ? <>
                                                                        <div className="text-[16px] text-muted mb-0.5">$<PriceDisplay value={pricing.effectivePerDay} />{copy.perDay} × {days} {days === 1 ? copy.day : copy.days}</div>
                                                                        <div className="font-syne font-extrabold text-[1.8rem] text-navy leading-none"><span className="text-[13px] font-bold">NZD</span>&nbsp;$<PriceDisplay value={pricing.discountedTotal} /><span className="text-[13px] font-normal text-muted ml-1">{copy.total}</span></div>
                                                                    </> : <div className="text-[13px] text-muted font-medium">{copy.priceUnavailable}</div>}
                                                                    {vehicle.nextAvailableDate ? <div className="rounded-xl border border-orange/20 bg-orange/5 px-3 py-2"><div className="text-[11px] font-bold text-orange">{copy.nextAvailable}: {vehicle.nextAvailableDate}</div><button type="button" onClick={() => useNextAvailableDate(vehicle)} className="mt-1 text-[11px] font-bold text-navy underline underline-offset-2">{copy.useThisDate}</button></div> : !vehicle.localFallback && <button type="button" onClick={() => lookupNextAvailableDate(vehicle)} disabled={nextAvailabilityLoading[String(vehicle.vehiclecategoryid)]} className="rounded-xl border border-orange/20 bg-orange/5 px-3 py-2 text-[11px] font-bold text-orange transition-colors hover:bg-orange/10 disabled:opacity-50">{nextAvailabilityLoading[String(vehicle.vehiclecategoryid)] ? `${copy.checkNextAvailable}...` : copy.checkNextAvailable}</button>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={(!selectable && !requestable) || hasUnappliedSearchChanges}
                                                            onClick={() => requestable ? openManualRequest(vehicle) : selectVehicle(vehicle)}
                                                            className={`flex items-center gap-2 text-white font-syne font-bold text-[14px] px-6 py-3 rounded-xl transition-all ${
                                                                (selectable || requestable) && !hasUnappliedSearchChanges
                                                                    ? 'bg-orange hover:bg-orange-dark hover:scale-[1.02] shadow-orange-glow'
                                                                    : 'bg-gray-300 text-white/90 cursor-not-allowed shadow-none'
                                                            }`}
                                                        >
                                                            {hasUnappliedSearchChanges ? copy.updateResultsFirst : requestable ? copy.requestBooking : copy.select} <ArrowRight size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                </div>
            </main>

            <div className="hidden lg:block">
                <div
                    className={`fixed left-[max(12px,calc((100vw-1400px)/2+8px))] top-[140px] z-40 w-[340px] xl:w-[380px] max-h-[calc(100vh-160px)] overflow-y-auto overflow-x-hidden rounded-[28px] transition-all duration-300 ${
                        showStickySearch ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'
                    }`}
                >
                    <VehicleSearchCard
                        form={searchForm}
                        setForm={setSearchForm}
                        onSearch={() => loadVehicles(searchForm)}
                        maxPrice={maxPrice}
                        setMaxPrice={setMaxPrice}
                        vehicleType={vehicleType}
                        setVehicleType={setVehicleType}
                        vehicleTypeOptions={vehicleTypeOptions}
                        promoCode={promoCode}
                        setPromoCode={setPromoCode}
                        copy={copy}
                        locale={locale}
                        compact
                    />
                </div>
            </div>

            {requestVehicle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
                        <button
                            type="button"
                            onClick={() => setRequestVehicle(null)}
                            className="absolute right-4 top-4 text-muted transition-colors hover:text-navy"
                            aria-label={copy.close}
                        >
                            <span className="text-2xl leading-none">×</span>
                        </button>

                        {requestSuccessRef ? (
                            <div className="py-8 text-center">
                                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">✓</div>
                                <h2 className="font-syne text-xl font-bold text-navy">{copy.requestSuccessTitle}</h2>
                                <p className="mt-3 text-sm leading-relaxed text-muted">{copy.requestSuccessBody}</p>
                                <p className="mt-5 rounded-xl bg-off-white px-4 py-3 text-xs text-muted">
                                    {copy.requestReference}: <strong className="text-navy">{requestSuccessRef}</strong>
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setRequestVehicle(null)}
                                    className="mt-6 w-full rounded-xl bg-orange py-3 text-sm font-bold text-white transition-colors hover:bg-orange-dark"
                                >
                                    {copy.close}
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="mb-6 pr-8">
                                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange">{copy.requestBooking}</div>
                                    <h2 className="mt-1 font-syne text-xl font-bold text-navy">{copy.requestTitle}</h2>
                                    <p className="mt-3 text-sm leading-relaxed text-muted">{copy.requestBody}</p>
                                    <p className="mt-3 text-sm font-semibold text-navy">
                                        {requestVehicle.categoryfriendlydescription || requestVehicle.vehiclecategory}
                                    </p>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {([
                                        ['firstName', copy.firstName, false],
                                        ['lastName', copy.lastName, false],
                                        ['email', copy.email, false],
                                        ['phone', copy.phone, false],
                                        ['wechat', copy.wechat, true],
                                    ] as const).map(([field, label]) => (
                                        <label key={field} className="block">
                                            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">{label}{field === 'wechat' && <span className="ml-1 normal-case font-medium tracking-normal text-muted/70">({copy.optional})</span>}</span>
                                            <input
                                                type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                                                value={requestForm[field]}
                                                onChange={event => setRequestForm(current => ({ ...current, [field]: event.target.value }))}
                                                className="w-full rounded-xl border border-black/10 bg-off-white px-4 py-3 text-sm text-navy outline-none transition-colors focus:border-orange"
                                            />
                                        </label>
                                    ))}
                                </div>
                                {requestError && <p className="mt-4 text-sm text-red-500">{requestError}</p>}
                                <button
                                    type="button"
                                    onClick={submitManualRequest}
                                    disabled={requestSubmitting}
                                    className="mt-6 w-full rounded-xl bg-orange py-3 text-sm font-bold text-white transition-colors hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {requestSubmitting ? copy.submittingRequest : copy.submitRequest}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {showTimingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
                        <button
                            onClick={() => setShowTimingModal(false)}
                            className="absolute top-4 right-4 text-muted hover:text-navy transition-colors"
                            aria-label={copy.close}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            </div>
                            <h2 className="font-syne font-bold text-navy text-lg">{copy.bookingTimeNotice}</h2>
                        </div>
                        <div className="space-y-3 text-[14px] text-gray-700 leading-relaxed mb-6">
                            <div className="flex gap-2.5">
                                <span className="text-orange font-bold mt-0.5">•</span>
                                <p>{copy.christchurchTiming}</p>
                            </div>
                            <div className="flex gap-2.5">
                                <span className="text-orange font-bold mt-0.5">•</span>
                                <p>{copy.otherTiming}</p>
                            </div>
                        </div>
                        <p className="text-[13px] text-muted mb-6">{copy.timingBody}</p>
                        <button
                            onClick={() => setShowTimingModal(false)}
                            className="w-full bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[14px] py-3 rounded-xl transition-colors"
                        >
                            {copy.timingCta}
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
