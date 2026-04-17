'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, User, Tag, X } from 'lucide-react'
import {
  toYMD, parseYMD, nextTimeSlot, getNZMinPickup,
  DateTimePicker, LocationSelect,
} from '@/components/booking/DateTimePicker'

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCATIONS = ['Christchurch', 'Queenstown', 'Auckland']

const DROPOFF_RULES: Record<string, string[]> = {
  'Christchurch': ['Christchurch', 'Queenstown'],
  'Queenstown':   ['Queenstown', 'Christchurch'],
  'Auckland':     ['Auckland'],
}

// ─── BookingSection ───────────────────────────────────────────────────────────

export default function BookingSection() {
  const router = useRouter()

  const [pickupLocation, setPickupLocation]   = useState('Christchurch')
  const [dropoffLocation, setDropoffLocation] = useState('Christchurch')
  const [pickupDate, setPickupDate]           = useState('')
  const [pickupTime, setPickupTime]           = useState('09:00')
  const [dropoffDate, setDropoffDate]         = useState('')
  const [dropoffTime, setDropoffTime]         = useState('09:00')
  const [driverAge, setDriverAge]             = useState<'over26' | 'under26'>('over26')
  const [promoCode, setPromoCode]             = useState('')
  const [promoOpen, setPromoOpen]             = useState(false)

  // Default: earliest valid pickup (NZ now + 6h), dropoff +7 days same time
  useEffect(() => {
    const { minDate, minHour } = getNZMinPickup()
    setPickupDate(minDate)
    setPickupTime(minHour)
    const dropDay = parseYMD(minDate); dropDay.setDate(dropDay.getDate() + 7)
    setDropoffDate(toYMD(dropDay))
    setDropoffTime(minHour)
  }, [])

  function handlePickupLocationChange(val: string) {
    setPickupLocation(val)
    const allowed = DROPOFF_RULES[val] || []
    if (!allowed.includes(dropoffLocation)) setDropoffLocation(allowed[0] || val)
  }

  function handlePickupDateChange(d: string) {
    setPickupDate(d)
    if (dropoffDate && dropoffDate < d) {
      const next = parseYMD(d); next.setDate(next.getDate() + 1)
      setDropoffDate(toYMD(next))
    }
    if ((dropoffDate === d || !dropoffDate) && dropoffTime <= pickupTime) {
      setDropoffTime(nextTimeSlot(pickupTime))
    }
  }

  function handleDropoffDateChange(d: string) {
    setDropoffDate(d)
    if (d === pickupDate && dropoffTime <= pickupTime) {
      setDropoffTime(nextTimeSlot(pickupTime))
    }
  }

  const allowedDropoffs = DROPOFF_RULES[pickupLocation] || LOCATIONS

  // Recompute NZ minimum on each render (date math is cheap)
  const nzMin = getNZMinPickup()
  const pickupMinTime = pickupDate === nzMin.minDate ? nzMin.minHour : undefined
  const sameDay = dropoffDate === pickupDate
  const dropoffMinTime = sameDay ? pickupTime : undefined

  function handleSearch() {
    const params = new URLSearchParams({
      pickupLocation, dropoffLocation,
      pickupDate, pickupTime,
      dropoffDate, dropoffTime,
      driverAge,
    })
    if (promoCode.trim()) params.set('promoCode', promoCode.trim().toUpperCase())
    router.push(`/booking/vehicles?${params.toString()}`)
  }

  return (
    <section id="booking" className="relative z-20 px-10" style={{ marginTop: '-90px' }}>
      <div className="animate-floating max-w-[1400px] mx-auto">
        <div className="rounded-2xl p-2" style={{
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderTop: '3px solid #e8431a',
          boxShadow: '0 8px 32px rgba(15,23,42,0.15)',
        }}>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-1.5 items-stretch rounded-xl p-1.5"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >

            <LocationSelect
              label="Pick-up Location"
              value={pickupLocation}
              options={LOCATIONS}
              onChange={handlePickupLocationChange}
            />
            <LocationSelect
              label="Drop-off Location"
              value={dropoffLocation}
              options={allowedDropoffs}
              onChange={setDropoffLocation}
            />

            <DateTimePicker
              label="Pick-up Date"
              value={pickupDate}
              time={pickupTime}
              minDate={nzMin.minDate}
              minTime={pickupMinTime}
              onChange={handlePickupDateChange}
              onTimeChange={setPickupTime}
              timeLabel="Pick-up Time"
            />

            <DateTimePicker
              label="Drop-off Date"
              value={dropoffDate}
              time={dropoffTime}
              minDate={pickupDate || nzMin.minDate}
              minTime={dropoffMinTime}
              onChange={handleDropoffDateChange}
              onTimeChange={setDropoffTime}
              timeLabel="Drop-off Time"
            />

            {/* Driver Age */}
            <div className="px-4 py-4 bg-white rounded-[10px] border border-black/10 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-[10.5px] text-muted uppercase tracking-[0.8px] mb-2 font-medium">
                <User size={10} className="text-orange" /> Driver Age
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setDriverAge('over26')}
                  className={`flex-1 text-[12px] font-syne font-bold py-1.5 rounded-lg border transition-all
                    ${driverAge === 'over26'
                      ? 'bg-orange border-orange text-white'
                      : 'border-black/15 text-muted hover:border-orange hover:text-orange'}`}
                >
                  26+
                </button>
                <button
                  onClick={() => setDriverAge('under26')}
                  className={`flex-1 text-[12px] font-syne font-bold py-1.5 rounded-lg border transition-all
                    ${driverAge === 'under26'
                      ? 'bg-orange border-orange text-white'
                      : 'border-black/15 text-muted hover:border-orange hover:text-orange'}`}
                >
                  Under 26
                </button>
              </div>
            </div>

            {/* Search */}
            <button
              onClick={handleSearch}
              className="flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[15px] px-8 rounded-xl h-full min-h-[72px] transition-all hover:scale-[1.03] whitespace-nowrap shadow-orange-glow"
            >
              <Search size={18} /> Search
            </button>
          </div>

          {/* ── Promo code ── */}
          <div className="px-3 pb-2.5 pt-1.5">
            {!promoOpen ? (
              <button
                onClick={() => setPromoOpen(true)}
                className="flex items-center gap-1.5 text-[12px] text-navy/50 hover:text-orange transition-colors font-medium"
              >
                <Tag size={12} className="text-orange/70" />
                Have a promo code?
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag size={13} className="text-orange flex-shrink-0" />
                <div className="flex items-center gap-1.5 bg-white border border-black/15 focus-within:border-orange rounded-lg px-3 py-1.5 transition-colors">
                  <input
                    autoFocus
                    type="text"
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Enter promo code"
                    className="bg-transparent text-[13px] font-syne font-bold text-navy placeholder:text-muted/50 outline-none tracking-widest w-[160px]"
                    maxLength={20}
                  />
                  {promoCode && (
                    <button onClick={() => setPromoCode('')} className="text-muted/50 hover:text-navy transition-colors flex-shrink-0">
                      <X size={12} />
                    </button>
                  )}
                </div>
                {promoCode && (
                  <span className="text-[11px] text-orange font-semibold">
                    ✓ Applied on search
                  </span>
                )}
                <button
                  onClick={() => { setPromoOpen(false); setPromoCode('') }}
                  className="text-[11px] text-muted/60 hover:text-navy transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
