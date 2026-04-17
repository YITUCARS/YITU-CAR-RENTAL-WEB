'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export interface InsuranceOption {
    id: number
    name: string
    fees: number
    feedescription: string
    isdefault: boolean
    type: string
    totalinsuranceamount: number
}

export interface BookingState {
    pickupLocation: string
    pickupLocationId: number
    reservationRef: string
    paymentType: 'deposit' | 'full' | 'manual'
    dropoffLocation: string
    dropoffLocationId: number
    pickupDate: string
    pickupTime: string
    dropoffDate: string
    dropoffTime: string
    driverAge: 'over26' | 'under26'
    vehicleId: string
    vehicleCategoryTypeId: number
    vehicleName: string
    basePricePerDay: number
    pricePerDay: number
    days: number
    afterHourFee: number   // 0, 65, or 130 — charged per out-of-hours pickup/dropoff
    promoCode: string
    promoDiscountType: 'percent' | 'fixed' | ''
    promoDiscountValue: number
    promoDiscountAmount: number
    extras: Record<string, number>
    selectedInsuranceId: number | null
    insuranceOptions: InsuranceOption[]
    totalAmount: number    // vehicle + afterHour + insurance + extras + young driver fee
    firstName: string
    lastName: string
    email: string
    phone: string
    flightNumber: string
    notes: string
}

const defaultState: BookingState = {
    pickupLocation: 'Christchurch',
    pickupLocationId: 1,
    dropoffLocation: 'Christchurch',
    reservationRef: '',
    paymentType: 'full',
    dropoffLocationId: 1,
    pickupDate: '',
    pickupTime: '10:00',
    dropoffDate: '',
    dropoffTime: '10:00',
    driverAge: 'over26',
    vehicleId: '',
    vehicleCategoryTypeId: 0,
    vehicleName: '',
    basePricePerDay: 0,
    pricePerDay: 0,
    days: 0,
    afterHourFee: 0,
    promoCode: '',
    promoDiscountType: '',
    promoDiscountValue: 0,
    promoDiscountAmount: 0,
    extras: {},
    selectedInsuranceId: null,
    insuranceOptions: [],
    totalAmount: 0,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    flightNumber: '',
    notes: '',
}

const BookingContext = createContext<{
    booking: BookingState
    setBooking: React.Dispatch<React.SetStateAction<BookingState>>
    isHydrated: boolean
}>({ booking: defaultState, setBooking: () => {}, isHydrated: false })

const STORAGE_KEY = 'yitu-booking'

export function BookingProvider({ children }: { children: React.ReactNode }) {
    const [booking, setBooking] = useState<BookingState>(() => {
        if (typeof window === 'undefined') return defaultState

        const savedBooking = window.sessionStorage.getItem(STORAGE_KEY)
        if (!savedBooking) return defaultState

        try {
            const parsedBooking = JSON.parse(savedBooking) as Partial<BookingState>
            return { ...defaultState, ...parsedBooking }
        } catch {
            window.sessionStorage.removeItem(STORAGE_KEY)
            return defaultState
        }
    })
    const [isHydrated, setIsHydrated] = useState(false)

    useEffect(() => {
        setIsHydrated(true)
    }, [])

    useEffect(() => {
        if (!isHydrated) return
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(booking))
    }, [booking, isHydrated])

    return (
        <BookingContext.Provider value={{ booking, setBooking, isHydrated }}>
            {children}
        </BookingContext.Provider>
    )
}

export const useBooking = () => useContext(BookingContext)

/**
 * Calculate rental days with grace period rule:
 * - Base: whole 24-hour periods between pickup and dropoff datetime.
 * - If the remaining minutes after whole days ≤ 60 → round down (grace period).
 * - If remaining > 60 min → round up (n+1 rule).
 * Minimum 1 day.
 */
export function calcDays(
    pickupDate: string, pickupTime: string,
    dropoffDate: string, dropoffTime: string,
): number {
    if (!pickupDate || !dropoffDate) return 0
    const [py, pm, pd] = pickupDate.split('-').map(Number)
    const [ph, pmin] = (pickupTime || '10:00').split(':').map(Number)
    const [dy, dm, dd] = dropoffDate.split('-').map(Number)
    const [dh, dmin] = (dropoffTime || '10:00').split(':').map(Number)
    const pickup  = new Date(py, pm - 1, pd, ph, pmin)
    const dropoff = new Date(dy, dm - 1, dd, dh, dmin)
    const totalMinutes = (dropoff.getTime() - pickup.getTime()) / 60000
    if (totalMinutes <= 0) return 1
    const wholeDays = Math.floor(totalMinutes / (24 * 60))
    const remainingMinutes = totalMinutes % (24 * 60)
    const days = remainingMinutes <= 60 ? wholeDays : wholeDays + 1
    return Math.max(1, days)
}

// Business hours: 08:30 – 17:30 NZ local time
const BIZ_START = 8 * 60 + 30   // 510 min
const BIZ_END   = 17 * 60 + 30  // 1050 min
const AFTER_HOUR_CHARGE = 65    // NZD per occurrence

function timeToMinutes(t: string): number {
    if (!t) return 10 * 60
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
}

function isAfterHours(time: string): boolean {
    const min = timeToMinutes(time)
    return min < BIZ_START || min > BIZ_END
}

/** Returns individual pickup/dropoff after-hour charges and their total. */
export function calcAfterHourBreakdown(pickupTime: string, dropoffTime: string): {
    pickupFee: number
    dropoffFee: number
    total: number
} {
    const pickupFee  = isAfterHours(pickupTime)  ? AFTER_HOUR_CHARGE : 0
    const dropoffFee = isAfterHours(dropoffTime) ? AFTER_HOUR_CHARGE : 0
    return { pickupFee, dropoffFee, total: pickupFee + dropoffFee }
}

export const LOCATION_IDS: Record<string, number> = {
    'Christchurch': 1,
    'Queenstown': 7,
    'Auckland': 8,
}

export function toRCMDate(date: string): string {
    if (!date) return ''
    const [y, m, d] = date.split('-')
    return `${d}/${m}/${y}`
}
