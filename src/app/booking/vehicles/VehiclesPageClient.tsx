'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Briefcase, ArrowRight, Search, SlidersHorizontal, Tag } from 'lucide-react'
import { useBooking, calcDays, calcAfterHourBreakdown, LOCATION_IDS } from '@/lib/booking-context'
import BookingFlowHeader from '@/components/booking/BookingFlowHeader'
import Navbar from '@/components/layout/Navbar'
import {
  toYMD, parseYMD, nextTimeSlot, getNZMinPickup,
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

const DROPOFF_RULES: Record<string, string[]> = {
    Christchurch: ['Christchurch', 'Queenstown'],
    Queenstown: ['Queenstown', 'Christchurch'],
    Auckland: ['Auckland'],
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

function roundMoney(value: number) {
    return Math.round(value * 100) / 100
}

function getVehiclePricing(vehicle: RCMVehicle, days: number) {
    const safeDays = Math.max(days, 1)
    const baseRatePerDay = roundMoney(vehicle.avgrate)
    const baseTotal = roundMoney(baseRatePerDay * safeDays)

    let promoDiscount = 0
    if (vehicle.totaldiscountamount > 0) {
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
    compact?: boolean
}) {
    const allowedDropoffs = DROPOFF_RULES[form.pickupLocation] || LOCATIONS
    const nzMin = getNZMinPickup()
    const sameDay = form.pickupDate === form.dropoffDate
    const pickupMinTime = form.pickupDate === nzMin.minDate ? nzMin.minHour : undefined
    const dropoffMinTime = sameDay ? form.pickupTime : undefined

    function updateField<K extends keyof SearchFormState>(field: K, value: SearchFormState[K]) {
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
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted font-bold">Refine Search</div>
                    <h3 className={`font-syne text-navy ${compact ? 'text-[1rem] font-bold' : 'text-[1.1rem] font-extrabold'}`}>
                        Adjust your trip and filters
                    </h3>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-orange/10 flex items-center justify-center flex-shrink-0">
                    <SlidersHorizontal size={18} className="text-orange" />
                </div>
            </div>

            {/* ── Location fields ── */}
            <div className={`grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-1 sm:grid-cols-2 gap-3'} ${compact ? '' : 'mb-3'}`}>
                <LocationSelect
                    label="Pick-up Location"
                    value={form.pickupLocation}
                    options={LOCATIONS}
                    onChange={v => updateField('pickupLocation', v)}
                />
                <LocationSelect
                    label="Drop-off Location"
                    value={form.dropoffLocation}
                    options={allowedDropoffs}
                    onChange={v => updateField('dropoffLocation', v)}
                />
            </div>

            {/* ── Date/Time fields ── */}
            <div className={`grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-2 xl:grid-cols-4 gap-3'}`}>
                <DateTimePicker
                    label="Pick-up Date"
                    value={form.pickupDate}
                    rangeEnd={form.dropoffDate}
                    time={form.pickupTime}
                    minDate={nzMin.minDate}
                    minTime={pickupMinTime}
                    onChange={d => updateField('pickupDate', d)}
                    onRangeEndChange={d => updateField('dropoffDate', d)}
                    onTimeChange={t => updateField('pickupTime', t)}
                    timeLabel="Pick-up Time"
                    showTime={false}
                    enableRangeSelection
                />
                <TimeSelect
                    label="Pick-up Time"
                    value={form.pickupTime}
                    minTime={pickupMinTime}
                    onChange={t => updateField('pickupTime', t)}
                />
                <DateTimePicker
                    label="Drop-off Date"
                    value={form.dropoffDate}
                    time={form.dropoffTime}
                    minDate={form.pickupDate || nzMin.minDate}
                    minTime={dropoffMinTime}
                    onChange={d => updateField('dropoffDate', d)}
                    onTimeChange={t => updateField('dropoffTime', t)}
                    timeLabel="Drop-off Time"
                    showTime={false}
                />
                <TimeSelect
                    label="Drop-off Time"
                    value={form.dropoffTime}
                    minTime={dropoffMinTime}
                    onChange={t => updateField('dropoffTime', t)}
                />
            </div>

            {/* ── Filters row ── */}
            <div className={`${compact ? 'mt-2' : 'mt-4'} grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-1 xl:grid-cols-4 gap-4'} items-end`}>
                <div>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="text-[10.5px] text-muted uppercase tracking-[0.14em] font-bold">Max Price / Day</span>
                        <span className="text-[12px] font-semibold text-orange">${maxPrice}</span>
                    </div>
                    <input
                        type="range"
                        min={60}
                        max={220}
                        step={10}
                        value={maxPrice}
                        onChange={e => setMaxPrice(Number(e.target.value))}
                        className="w-full accent-orange"
                    />
                </div>

                <label className="block">
                    <span className="text-[10.5px] text-muted uppercase tracking-[0.14em] font-bold mb-1.5 block">Vehicle Type</span>
                    <select
                        value={vehicleType}
                        onChange={e => setVehicleType(e.target.value)}
                        className={`w-full rounded-xl border border-black/10 bg-off-white px-4 ${compact ? 'py-2' : 'py-3'} text-[14px] text-navy outline-none focus:border-orange`}
                    >
                        <option value="all">All types</option>
                        {vehicleTypeOptions.map(option => (
                            <option key={option.id} value={String(option.id)}>
                                {option.vehiclecategorytype}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <span className="flex items-center gap-1.5 text-[10.5px] text-muted uppercase tracking-[0.14em] font-bold mb-1.5">
                        <Tag size={11} className="text-orange" /> Promo Code
                    </span>
                    <div className={`rounded-xl border border-black/10 bg-off-white px-4 ${compact ? 'py-2' : 'py-3'} flex items-center gap-2`}>
                        <input
                            type="text"
                            value={promoCode}
                            onChange={e => setPromoCode(e.target.value.toUpperCase())}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSearch() } }}
                            placeholder="Enter promo code"
                            className="flex-1 bg-transparent text-[14px] font-semibold tracking-[0.14em] text-navy outline-none placeholder:text-muted/55"
                        />
                        {promoCode && (
                            <button
                                type="button"
                                onClick={onSearch}
                                className="text-[11px] font-bold text-white bg-orange hover:bg-orange-dark px-3 py-1 rounded-lg transition-colors whitespace-nowrap"
                            >
                                Apply
                            </button>
                        )}
                    </div>
                    {promoCode && (
                        <div className="mt-1.5 text-[11px] text-muted">
                            Press Apply or Update Results to search with this code
                        </div>
                    )}
                </label>

                <div className={`${compact ? '' : 'xl:min-w-[170px]'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10.5px] text-muted uppercase tracking-[0.14em] font-bold">Driver Age</span>
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
                            Under 26
                        </button>
                    </div>
                    <button
                        onClick={onSearch}
                        className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[14px] px-5 ${compact ? 'py-2' : 'py-3'} shadow-orange-glow transition-all`}
                    >
                        <Search size={16} /> Update Results
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function VehiclesPage() {
    const router = useRouter()
    const params = useSearchParams()
    const { booking, setBooking } = useBooking()

    const initialPickupLocation = params.get('pickupLocation') || booking.pickupLocation || 'Christchurch'
    const initialDropoffLocation = params.get('dropoffLocation') || booking.dropoffLocation || 'Christchurch'
    const initialPickupDate = params.get('pickupDate') || booking.pickupDate || getNZMinPickup().minDate
    const initialPickupTime = params.get('pickupTime') || '10:00'
    const initialDropoffDate = params.get('dropoffDate') || booking.dropoffDate || getNZMinPickup().minDate
    const initialDropoffTime = params.get('dropoffTime') || '10:00'
    const initialDriverAge = (params.get('driverAge') as DriverAge) || booking.driverAge || 'over26'
    const initialPromoCode = params.get('promoCode') || booking.promoCode || ''

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
    const [maxPrice, setMaxPrice] = useState(220)
    const [vehicleType, setVehicleType] = useState('all')
    const [showStickySearch, setShowStickySearch] = useState(false)
    const [promoCode, setPromoCode] = useState(initialPromoCode.toUpperCase())

    const days = calcDays(searchForm.pickupDate, searchForm.pickupTime, searchForm.dropoffDate, searchForm.dropoffTime)

    useEffect(() => {
        function onScroll() {
            setShowStickySearch(window.scrollY > 560)
        }

        onScroll()
        window.addEventListener('scroll', onScroll)
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    async function loadVehicles(form: SearchFormState) {
        setLoading(true)
        setError('')

        const activePromoCode = promoCode.trim().toUpperCase()
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
                setVehicles(result.data.availablecars)
                setSearchResults(result.data)
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
                router.replace(`/booking/vehicles?${query.toString()}`)
            } else {
                setVehicles([])
                setSearchResults(null)
                setError(result.error || 'Unable to load available vehicles. Please try again.')
            }
        } catch (error) {
            console.error('Vehicle search request failed:', error)
            setVehicles([])
            setSearchResults(null)
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadVehicles(searchForm)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
            promoCode: promoCode.trim().toUpperCase(),
            promoDiscountType: '',
            promoDiscountValue: 0,
            promoDiscountAmount: pricing.promoDiscount,
            insuranceOptions: vehicleInsurance,
            selectedInsuranceId: vehicleInsurance.find((item: any) => item.isdefault)?.id ?? null,
        }))

        router.push('/booking/extras')
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
                            <span className="block text-[10px] uppercase tracking-wider mb-0.5 text-muted/70">Pick-up</span>
                            <span className="font-semibold text-navy">{searchForm.pickupLocation} · {searchForm.pickupDate} {searchForm.pickupTime}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase tracking-wider mb-0.5 text-muted/70">Drop-off</span>
                            <span className="font-semibold text-navy">{searchForm.dropoffLocation} · {searchForm.dropoffDate} {searchForm.dropoffTime}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase tracking-wider mb-0.5 text-muted/70">Duration</span>
                            <span className="font-semibold text-orange">{days} day{days !== 1 ? 's' : ''}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase tracking-wider mb-0.5 text-muted/70">Driver Age</span>
                            <span className={`font-semibold ${searchForm.driverAge === 'under26' ? 'text-orange' : 'text-navy'}`}>
                                {searchForm.driverAge === 'under26' ? 'Under 26' : '26+'}
                            </span>
                        </div>
                    </div>
                }
            />

            <main className="max-w-[1260px] mx-auto px-6 lg:px-10 py-10">
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
                />

                <div className="mt-8 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-8 items-start">
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
                                    Try search again
                                </button>
                            </div>
                        )}

                        {!loading && !error && (
                            <>
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                                    <div>
                                        <h2 className="font-syne font-bold text-navy text-xl">
                                            {filteredVehicles.length} vehicles available
                                        </h2>
                                        <p className="text-[13px] text-muted mt-1">
                                            Results update from your new dates, times, locations, price cap, and vehicle type filter.
                                        </p>
                                    </div>
                                    {searchForm.driverAge === 'under26' && (
                                        <span className="text-[12px] bg-orange/10 text-orange font-semibold px-3 py-1.5 rounded-full">
                                            Young Driver Fee applies · +$30/day
                                        </span>
                                    )}
                                </div>

                                {vehicles.length === 0 ? (
                                    <div className="bg-white border border-black/10 rounded-card p-8 text-center">
                                        <h3 className="font-syne font-bold text-navy text-lg">No vehicles available</h3>
                                        <p className="text-muted text-[14px] mt-2">
                                            No vehicles are available for your selected dates and locations. Try adjusting your pick-up or drop-off times.
                                        </p>
                                        <button
                                            onClick={() => loadVehicles(searchForm)}
                                            className="mt-4 text-orange underline text-sm"
                                        >
                                            Search again
                                        </button>
                                    </div>
                                ) : filteredVehicles.length === 0 ? (
                                    <div className="bg-white border border-black/10 rounded-card p-8 text-center">
                                        <h3 className="font-syne font-bold text-navy text-lg">No vehicles match these filters</h3>
                                        <p className="text-muted text-[14px] mt-2">
                                            Try increasing the max price or switching to another vehicle type.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {filteredVehicles.map(vehicle => {
                                            const pricing = getVehiclePricing(vehicle, days)
                                            const selectable = isVehicleSelectable(vehicle)
                                            return (
                                            <div
                                                key={vehicle.vehiclecategoryid}
                                                className="bg-white border border-black/10 rounded-card overflow-hidden flex flex-col sm:flex-row hover:border-orange/30 hover:shadow-card transition-all"
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
                                                            No image
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
                                                        </div>
                                                        <h3 className="font-syne font-bold text-xl text-navy mb-3">
                                                            {vehicle.categoryfriendlydescription || vehicle.vehiclecategory}
                                                        </h3>
                                                        <div className="flex gap-4 flex-wrap mb-3">
                                                            <span className="flex items-center gap-1.5 text-[13px] text-muted">
                                                                <Users size={13} className="text-orange" />
                                                                {vehicle.numberofadults} Adults
                                                            </span>
                                                            <span className="flex items-center gap-1.5 text-[13px] text-muted">
                                                                <Briefcase size={13} className="text-orange" />
                                                                {vehicle.numberoflargecases} Large + {vehicle.numberofsmallcases} Small bags
                                                            </span>
                                                        </div>
                                                        {vehicle.availablemessage && (
                                                            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                                                                selectable ? 'bg-green-50 text-green-700' : 'bg-orange/10 text-orange'
                                                            }`}>
                                                                {vehicle.availablemessage}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-end justify-between mt-5 pt-4 border-t border-black/[0.07] gap-4">
                                                        <div>
                                                            {selectable ? (
                                                                <>
                                                                    <div className="text-[11px] text-muted mb-0.5">
                                                                        ${pricing.effectivePerDay.toLocaleString()}/day × {days} days
                                                                        {searchForm.driverAge === 'under26' && (
                                                                            <span className="text-orange ml-1">+ Young Driver Fee</span>
                                                                        )}
                                                                    </div>
                                                                    {pricing.promoDiscount > 0 && (
                                                                        <div className="text-[11px] text-green-700 font-medium mb-1">
                                                                            Promo {promoCode} applied · save ${pricing.promoDiscount.toLocaleString()}
                                                                        </div>
                                                                    )}
                                                                    <div className="font-syne font-extrabold text-[1.8rem] text-navy leading-none">
                                                                        ${pricing.discountedTotal.toLocaleString()}
                                                                        <span className="text-[13px] font-normal text-muted ml-1">total</span>
                                                                    </div>
                                                                    {pricing.promoDiscount > 0 && (
                                                                        <div className="text-[11px] text-muted line-through mt-1">
                                                                            ${pricing.baseTotal.toLocaleString()} original
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <div className="text-[13px] text-muted font-medium">
                                                                    Price unavailable
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={!selectable}
                                                            onClick={() => selectVehicle(vehicle)}
                                                            className={`flex items-center gap-2 text-white font-syne font-bold text-[14px] px-6 py-3 rounded-xl transition-all ${
                                                                selectable
                                                                    ? 'bg-orange hover:bg-orange-dark hover:scale-[1.02] shadow-orange-glow'
                                                                    : 'bg-gray-300 text-white/90 cursor-not-allowed shadow-none'
                                                            }`}
                                                        >
                                                            Select <ArrowRight size={15} />
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
                    className={`fixed left-[max(12px,calc((100vw-1260px)/2+4px))] top-[140px] z-40 w-[280px] max-h-[calc(100vh-160px)] overflow-y-auto rounded-[28px] transition-all duration-300 ${
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
                        compact
                    />
                </div>
            </div>
        </>
    )
}
