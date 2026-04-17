'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Clock, MapPin, Check } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

export const HOURS = Array.from({ length: 48 }, (_, index) => {
  const totalMinutes = index * 30
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  const suffix = hour < 12 ? 'AM' : 'PM'
  const minuteLabel = minute === 0 ? '' : ':30'
  return { value, label: `${displayHour}${minuteLabel} ${suffix}` }
})

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function toYMD(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function nextTimeSlot(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  const totalMinutes = Math.min(hour * 60 + minute + 30, 23 * 60 + 30)
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
}

function formatDisplay(ymd: string) {
  if (!ymd) return 'Select date'
  return parseYMD(ymd).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** Returns the earliest allowed pickup: NZ local time + 6 h, rounded up to
 *  the next 30-minute slot.  If the result pushes past midnight, rolls over
 *  to next day at 00:00.
 */
export function getNZMinPickup(): { minDate: string; minHour: string } {
  const now = new Date()
  const earliest = new Date(now.getTime() + 6 * 60 * 60 * 1000)

  let minDate = earliest.toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })

  const nzHourRaw = parseInt(
    earliest.toLocaleString('en-US', { timeZone: 'Pacific/Auckland', hour: '2-digit', hour12: false }),
    10,
  )
  const nzMinuteRaw = parseInt(
    earliest.toLocaleString('en-US', { timeZone: 'Pacific/Auckland', minute: '2-digit' }),
    10,
  )

  let totalMinutes = nzHourRaw * 60 + nzMinuteRaw
  totalMinutes = Math.ceil(totalMinutes / 30) * 30

  if (totalMinutes >= 24 * 60) {
    const nextDay = parseYMD(minDate)
    nextDay.setDate(nextDay.getDate() + 1)
    minDate = toYMD(nextDay)
    totalMinutes = 0
  }

  totalMinutes = Math.max(0, Math.min(totalMinutes, 23 * 60 + 30))
  const minHour = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`

  return { minDate, minHour }
}

// ─── DateTimePicker ───────────────────────────────────────────────────────────

export function DateTimePicker({
  label,
  value,
  time,
  minDate,
  minTime,
  onChange,
  onTimeChange,
  timeLabel,
}: {
  label: string
  value: string
  time: string
  minDate: string
  minTime?: string
  onChange: (d: string) => void
  onTimeChange: (t: string) => void
  timeLabel: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const minDateObj = minDate ? parseYMD(minDate) : new Date()
  minDateObj.setHours(0, 0, 0, 0)

  const initBase = value ? parseYMD(value) : minDateObj
  const [viewYear, setViewYear] = useState(initBase.getFullYear())
  const [viewMonth, setViewMonth] = useState(initBase.getMonth())

  useEffect(() => {
    if (value) {
      const d = parseYMD(value)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const minMonthStart = new Date(minDateObj.getFullYear(), minDateObj.getMonth(), 1)
  const canGoPrev = new Date(viewYear, viewMonth - 1, 1) >= minMonthStart

  function prevMonth() {
    if (!canGoPrev) return
    const p = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(p.getFullYear()); setViewMonth(p.getMonth())
  }
  function nextMonth() {
    const n = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(n.getFullYear()); setViewMonth(n.getMonth())
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const todayYMD = toYMD(new Date())

  return (
    <div ref={ref} className="relative h-full">

      {/* ── Trigger ── */}
      <div
        onClick={() => setOpen(o => !o)}
        className={`px-4 py-4 bg-white rounded-[10px] border cursor-pointer transition-all select-none h-full flex flex-col justify-center
          ${open ? 'border-orange' : 'border-black/10 hover:border-orange'}`}
      >
        <div className="flex items-center gap-1.5 text-[10.5px] text-muted uppercase tracking-[0.8px] mb-1.5 font-medium">
          <Calendar size={10} className="text-orange" />
          {label}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 whitespace-nowrap rounded-md bg-orange/8 px-2.5 py-1">
              <Clock size={10} className="text-orange" />
              <span className="text-[11px] font-semibold text-orange">
                {HOURS.find(h => h.value === time)?.label ?? '—'}
              </span>
            </div>
            <div className="text-[14px] text-navy font-dm font-semibold leading-tight whitespace-nowrap">
              {formatDisplay(value)}
            </div>
          </div>
          <ChevronDown size={14} className={`text-muted/60 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* ── Popup ── */}
      {open && (
        <div className="absolute top-[calc(100%+10px)] left-0 z-50 w-[320px] sm:w-[560px] bg-white rounded-2xl border border-black/8 shadow-[0_24px_64px_rgba(15,23,42,0.2)] overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            <div className="flex-1">
              {/* Month header */}
              <div className="flex items-center justify-between px-4 py-3 bg-navy">
                <button
                  onClick={prevMonth}
                  disabled={!canGoPrev}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-25 hover:bg-white/10"
                >
                  <ChevronLeft size={15} className="text-white" />
                </button>
                <span className="text-[13px] font-syne font-bold text-white tracking-wide">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <button
                  onClick={nextMonth}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                >
                  <ChevronRight size={15} className="text-white" />
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 px-3 pt-3 pb-1">
                {DOW_LABELS.map(d => (
                  <div key={d} className="text-center text-[10px] font-bold text-muted uppercase tracking-wide py-0.5">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
                {cells.map((day, i) => {
                  if (day === null) return <div key={`e${i}`} />
                  const cellDate = new Date(viewYear, viewMonth, day)
                  cellDate.setHours(0, 0, 0, 0)
                  const cellYMD = toYMD(cellDate)
                  const disabled = cellDate < minDateObj
                  const isSelected = cellYMD === value
                  const isToday = cellYMD === todayYMD

                  return (
                    <button
                      key={day}
                      disabled={disabled}
                      onClick={() => onChange(cellYMD)}
                      className={[
                        'aspect-square rounded-full text-[13px] font-medium transition-all flex items-center justify-center w-full',
                        isSelected
                          ? 'bg-orange text-white font-bold shadow-sm'
                          : disabled
                          ? 'text-black/20 cursor-not-allowed'
                          : isToday
                          ? 'text-orange font-semibold'
                          : 'text-navy hover:bg-orange/10 hover:text-orange cursor-pointer',
                      ].join(' ')}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time slots */}
            <div className="border-t border-black/8 px-4 pt-3 pb-4 sm:w-[220px] sm:border-t-0 sm:border-l">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-2.5">
                <Clock size={9} className="text-orange" />
                {timeLabel}
              </div>
              <div className="max-h-[260px] overflow-y-auto pr-1">
                <div className="grid grid-cols-3 sm:grid-cols-2 gap-1">
                  {HOURS.map(h => {
                    const isDisabled = minTime ? h.value <= minTime : false
                    const isActive = time === h.value
                    return (
                      <button
                        key={h.value}
                        disabled={isDisabled}
                        onClick={() => onTimeChange(h.value)}
                        className={[
                          'text-[11px] font-medium py-1.5 rounded-lg border transition-all',
                          isActive
                            ? 'bg-orange border-orange text-white font-bold'
                            : isDisabled
                            ? 'border-black/6 text-black/20 cursor-not-allowed'
                            : 'border-black/10 text-muted hover:border-orange hover:text-orange',
                        ].join(' ')}
                      >
                        {h.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── LocationSelect ───────────────────────────────────────────────────────────

export function LocationSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (val: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative h-full">
      <div
        onClick={() => setOpen(o => !o)}
        className="px-4 py-4 bg-white rounded-[10px] border border-black/10 cursor-pointer transition-all hover:border-orange select-none h-full flex flex-col justify-center"
      >
        <div className="flex items-center gap-1.5 text-[10.5px] text-muted uppercase tracking-[0.8px] mb-2 font-medium">
          <MapPin size={10} className="text-orange" /> {label}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[15px] text-navy font-dm font-medium">{value}</span>
          <ChevronDown size={15} className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {open && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 bg-white rounded-xl border border-black/10 shadow-[0_16px_48px_rgba(15,23,42,0.15)] overflow-hidden">
          {options.map(opt => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setOpen(false) }}
              className={`flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors text-[14px] font-dm
                ${opt === value ? 'bg-orange/10 text-orange font-semibold' : 'text-navy hover:bg-off-white'}`}
            >
              <div className="flex items-center gap-2.5">
                <MapPin size={13} className={opt === value ? 'text-orange' : 'text-muted'} />
                {opt}
              </div>
              {opt === value && <Check size={14} className="text-orange" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
