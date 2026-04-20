'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X, CalendarCheck, Search, Loader2, AlertCircle, CheckCircle2,
  MapPin, Calendar, Clock, User, CreditCard, ArrowLeft, AlertTriangle, Car,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 'search' | 'details' | 'cancel' | 'cancelled'

/* ── Raw API response shape ─────────────────────────────────────────────── */
interface BookingInfo {
  reservationref?: string
  reservationno?: number
  reservationstatus?: string
  reservationdocumentno?: string
  vehiclecategory?: string
  vehicleimage?: string
  urlpathfordocuments?: string
  pickupdate?: string
  pickuptime?: string
  pickuplocationname?: string
  dropoffdate?: string
  dropofftime?: string
  dropofflocationname?: string
  numberofdays?: number
  dailyrate?: number
  totalcost?: number
  payment?: number
  balancedue?: number
  isclosed?: boolean
  [key: string]: any
}
interface CustomerInfo {
  firstname?: string
  lastname?: string
  email?: string
  [key: string]: any
}
interface PaymentInfo {
  paidamount?: number
  paymenttype?: string
  [key: string]: any
}
interface ExtraFee {
  name?: string
  totalfeeamount?: number
  isinsurancefee?: boolean
  isoptionalfee?: boolean
}
interface RawBookingData {
  bookinginfo?: BookingInfo[]
  customerinfo?: CustomerInfo[]
  paymentinfo?: PaymentInfo[]
  extrafees?: ExtraFee[]
  [key: string]: any
}

interface CancelReason {
  id?: number
  cancelreasonid?: number
  name?: string
  cancelreason?: string
}

interface ManageBookingModalProps {
  open: boolean
  onClose: () => void
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function formatDate(d?: string) {
  if (!d) return '—'
  try {
    // "22/Apr/2026" → parse directly
    if (/^\d{1,2}\/[A-Za-z]{3}\/\d{4}$/.test(d)) {
      return new Date(d.replace(/(\d+)\/(\w+)\/(\d+)/, '$1 $2 $3'))
        .toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
    }
    // "DD/MM/YYYY"
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
      const [day, month, year] = d.split('/')
      return new Date(`${year}-${month}-${day}`)
        .toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
    }
    return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return d }
}

function formatTime(t?: string) {
  if (!t) return '—'
  const [h, m] = t.split(':')
  const hour = Number(h)
  return `${hour % 12 || 12}:${m ?? '00'} ${hour >= 12 ? 'PM' : 'AM'}`
}

function statusStyle(s?: string) {
  const st = (s ?? '').toLowerCase()
  if (st === 'reservation' || st.includes('confirm') || st === 'active')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (st.includes('cancel')) return 'bg-red-50 text-red-600 border-red-200'
  if (st.includes('complet') || st.includes('closed')) return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-orange/10 text-orange border-orange/30'
}

function canCancel(s?: string) {
  const st = (s ?? '').toLowerCase()
  return !st.includes('cancel') && !st.includes('complet') && !st.includes('closed')
}

function ErrorBanner({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-[9px] px-3.5 py-3 text-[13px] text-red-600', className)}>
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      {message}
    </div>
  )
}

/* ── Component ──────────────────────────────────────────────────────────── */
export default function ManageBookingModal({ open, onClose }: ManageBookingModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('search')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [refNumber, setRefNumber] = useState('')
  const [lastName, setLastName] = useState('')
  const [rawData, setRawData] = useState<RawBookingData | null>(null)

  const [cancelReasons, setCancelReasons] = useState<CancelReason[]>([])
  const [reasonsLoading, setReasonsLoading] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [cancelNote, setCancelNote] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [refundSuccess, setRefundSuccess] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('search'); setRefNumber(''); setLastName('')
        setRawData(null); setError(null)
        setSelectedReason(''); setCancelNote(''); setCancelReasons([])
      }, 300)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!open) return null

  /* ── Derived data from nested API response ── */
  const b: BookingInfo = rawData?.bookinginfo?.[0] ?? {}
  const c: CustomerInfo = rawData?.customerinfo?.[0] ?? {}
  const p: PaymentInfo = rawData?.paymentinfo?.[0] ?? {}
  const extras: ExtraFee[] = (rawData?.extrafees ?? []).filter(e => (e.totalfeeamount ?? 0) > 0)

  const imageUrl = b.urlpathfordocuments && b.vehicleimage
    ? `${b.urlpathfordocuments}${b.vehicleimage}` : null

  const totalCost = Number(b.totalcost ?? 0)
  const depositPaid = Number(p.paidamount ?? b.payment ?? 0)
  const balanceDue = Number(b.balancedue ?? Math.max(totalCost - depositPaid, 0))
  const refDisplay = b.reservationdocumentno ?? b.reservationref ?? refNumber

  /* ── Handlers ── */
  const handleFind = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!refNumber.trim() || !lastName.trim()) { setError('Please enter both fields.'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/rcm/find-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationRef: refNumber.trim(), lastName: lastName.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Booking not found.')
      setRawData(data.booking)
      setStep('details')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStartCancel = async () => {
    setError(null); setStep('cancel')
    if (cancelReasons.length === 0) {
      setReasonsLoading(true)
      try {
        const res = await fetch('/api/rcm/cancel-reasons', { method: 'POST' })
        const data = await res.json()
        if (data.success && Array.isArray(data.reasons)) setCancelReasons(data.reasons)
      } catch { } finally { setReasonsLoading(false) }
    }
  }

  const handleConfirmCancel = async () => {
    if (!selectedReason) return
    setCancelling(true); setError(null)
    try {
      const res = await fetch('/api/rcm/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationRef: b.reservationref ?? refNumber,
          cancelReasonId: Number(selectedReason) || 0,
          notes: cancelNote,
          bookingDetails: {
            vehicleName: b.vehiclecategory,
            pickupDate: b.pickupdate,
            dropoffDate: b.dropoffdate,
            location: b.pickuplocationname,
            paidAmount: depositPaid,
            paymentType: p.paymenttype,
            documentNo: refDisplay,
          },
          customerDetails: {
            name: [c.firstname, c.lastname].filter(Boolean).join(' '),
            email: c.email,
          },
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Cancellation failed.')
      setRefundSuccess(data.refundSuccess ?? false)
      setStep('cancelled')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCancelling(false)
    }
  }

  const reasonId = (r: CancelReason) => String(r.id ?? r.cancelreasonid ?? '')
  const reasonLabel = (r: CancelReason) => r.name ?? r.cancelreason ?? ''

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={cn(
        'bg-off-white border border-black/10 rounded-card w-full overflow-hidden animate-modal-in',
        step === 'details' || step === 'cancel' ? 'max-w-[580px]' : 'max-w-[460px]'
      )}>

        {/* Header */}
        <div className="bg-white border-b border-black/[0.08] px-5 py-4 flex items-center gap-3 shrink-0">
          {step === 'cancel' && (
            <button onClick={() => { setStep('details'); setError(null) }}
              className="flex items-center gap-1 text-muted hover:text-navy transition-colors shrink-0">
              <ArrowLeft size={15} />
              <span className="text-[13px] font-medium">Back</span>
            </button>
          )}
          <h3 className="font-syne font-bold text-[15px] text-navy flex items-center gap-2 mx-auto">
            <CalendarCheck size={15} className="text-orange" />
            {step === 'cancelled' ? 'Booking Cancelled' : step === 'cancel' ? 'Cancel Booking' : 'Manage My Booking'}
          </h3>
          <button onClick={onClose} className="ml-auto shrink-0 text-muted hover:text-navy transition-colors" aria-label="Close">
            <X size={19} />
          </button>
        </div>

        <div className="max-h-[84vh] overflow-y-auto">

          {/* ── SEARCH ── */}
          {step === 'search' && (
            <form onSubmit={handleFind} className="px-5 py-6">
              <p className="text-muted text-[13.5px] leading-[1.65] mb-5">
                Enter your <strong className="text-navy">reservation reference</strong> (shown on your confirmation page) and your last name.
              </p>
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.8px] mb-1.5">
                  Reservation Reference
                </label>
                <input ref={inputRef} value={refNumber} onChange={e => setRefNumber(e.target.value)}
                  type="text" placeholder="e.g. 001912BA8D6420D"
                  className="w-full bg-white border-[1.5px] border-black/10 rounded-[9px] px-3.5 py-3 text-[14px] text-navy placeholder:text-muted/50 focus:outline-none focus:border-orange transition-colors" />
              </div>
              <div className="mb-5">
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.8px] mb-1.5">
                  Last Name
                </label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  type="text" placeholder="e.g. Smith"
                  className="w-full bg-white border-[1.5px] border-black/10 rounded-[9px] px-3.5 py-3 text-[14px] text-navy placeholder:text-muted/50 focus:outline-none focus:border-orange transition-colors" />
              </div>
              {error && <ErrorBanner message={error} className="mb-4" />}
              <button type="submit" disabled={loading}
                className="w-full bg-navy hover:bg-navy-mid disabled:opacity-60 text-white rounded-[9px] py-3.5 font-syne font-bold text-[14px] flex items-center justify-center gap-2 transition-colors">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                {loading ? 'Searching…' : 'Find My Booking'}
              </button>
            </form>
          )}

          {/* ── DETAILS ── */}
          {step === 'details' && rawData && (
            <div className="px-5 py-5 space-y-3">

              {/* Vehicle card */}
              <div className="bg-white border border-black/10 rounded-[12px] p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={cn('inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border', statusStyle(b.reservationstatus))}>
                        {b.reservationstatus || 'Confirmed'}
                      </span>
                      <span className="text-[11px] text-muted">{refDisplay}</span>
                    </div>
                    <h4 className="font-syne font-bold text-navy text-[15px] leading-snug">
                      {b.vehiclecategory || 'Vehicle'}
                    </h4>
                    <p className="text-[12px] text-muted mt-0.5">
                      {b.numberofdays} day{(b.numberofdays ?? 0) > 1 ? 's' : ''} · ${b.dailyrate}/day
                    </p>
                  </div>
                  {imageUrl ? (
                    <img src={imageUrl} alt="vehicle" className="h-16 w-24 object-contain shrink-0" />
                  ) : (
                    <div className="h-14 w-20 bg-off-white rounded-lg flex items-center justify-center shrink-0">
                      <Car size={22} className="text-muted/40" />
                    </div>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Pickup', date: b.pickupdate, time: b.pickuptime, location: b.pickuplocationname },
                  { label: 'Drop-off', date: b.dropoffdate, time: b.dropofftime, location: b.dropofflocationname },
                ].map(({ label, date, time, location }) => (
                  <div key={label} className="bg-white border border-black/10 rounded-[12px] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-orange mb-2">{label}</div>
                    <div className="flex items-center gap-1.5 text-[12.5px] text-navy font-medium mb-1">
                      <Calendar size={11} className="text-muted shrink-0" />{formatDate(date)}
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-muted mb-1.5">
                      <Clock size={11} className="shrink-0" />{formatTime(time)}
                    </div>
                    {location && (
                      <div className="flex items-start gap-1.5 text-[11.5px] text-muted">
                        <MapPin size={11} className="mt-0.5 shrink-0" />{location}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Renter + Pricing */}
              <div className="bg-white border border-black/10 rounded-[12px] p-4 space-y-3">
                {(c.firstname || c.email) && (
                  <div className="flex items-center gap-2 text-[13px] text-muted pb-3 border-b border-black/[0.06]">
                    <User size={13} className="text-orange shrink-0" />
                    <span className="truncate">
                      {[c.firstname, c.lastname].filter(Boolean).join(' ')}
                      {c.email && <span className="ml-2 text-[11.5px] opacity-60">· {c.email}</span>}
                    </span>
                  </div>
                )}

                {/* Extras */}
                {extras.length > 0 && (
                  <div className="pb-3 border-b border-black/[0.06] space-y-1.5">
                    {extras.map((ex, i) => (
                      <div key={i} className="flex justify-between text-[12.5px]">
                        <span className="text-muted">{ex.name}</span>
                        <span className="text-navy font-medium">${Number(ex.totalfeeamount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pricing */}
                <div className="flex items-center gap-1.5 mb-1">
                  <CreditCard size={13} className="text-orange shrink-0" />
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wide">Pricing</span>
                </div>
                <div className="space-y-1.5 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-muted">Total</span>
                    <span className="font-semibold text-navy">${totalCost.toFixed(2)}</span>
                  </div>
                  {depositPaid > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted">Deposit Paid {p.paymenttype && `(${p.paymenttype.toUpperCase()})`}</span>
                      <span className="text-emerald-600 font-medium">${depositPaid.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 border-t border-black/[0.06]">
                    <span className="text-muted font-medium">Balance Due</span>
                    <span className="font-bold text-navy">${balanceDue.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Cancel CTA */}
              {canCancel(b.reservationstatus) && (
                <button onClick={handleStartCancel}
                  className="w-full border-[1.5px] border-red-300 text-red-500 hover:bg-red-50 hover:border-red-400 rounded-[9px] py-3 font-syne font-bold text-[13px] flex items-center justify-center gap-2 transition-colors">
                  Cancel This Booking
                </button>
              )}
            </div>
          )}

          {/* ── CANCEL ── */}
          {step === 'cancel' && (
            <div className="px-5 py-5">
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-[12px] p-4 mb-5">
                <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[13.5px] font-semibold text-red-700 mb-0.5">Are you sure you want to cancel?</p>
                  <p className="text-[12.5px] text-red-500">
                    {b.vehiclecategory} · {refDisplay} — this action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.8px] mb-1.5">
                  Reason <span className="text-red-400">*</span>
                </label>
                {reasonsLoading ? (
                  <div className="flex items-center gap-2 text-[13px] text-muted py-3">
                    <Loader2 size={14} className="animate-spin" /> Loading reasons…
                  </div>
                ) : cancelReasons.length > 0 ? (
                  <select value={selectedReason} onChange={e => setSelectedReason(e.target.value)}
                    className="w-full bg-white border-[1.5px] border-black/10 rounded-[9px] px-3.5 py-3 text-[14px] text-navy focus:outline-none focus:border-orange transition-colors">
                    <option value="">Select a reason…</option>
                    {cancelReasons.map(r => (
                      <option key={reasonId(r)} value={reasonId(r)}>{reasonLabel(r)}</option>
                    ))}
                  </select>
                ) : (
                  <input value={selectedReason} onChange={e => setSelectedReason(e.target.value)}
                    type="text" placeholder="Describe your reason for cancellation"
                    className="w-full bg-white border-[1.5px] border-black/10 rounded-[9px] px-3.5 py-3 text-[14px] text-navy placeholder:text-muted/50 focus:outline-none focus:border-orange transition-colors" />
                )}
              </div>

              <div className="mb-5">
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.8px] mb-1.5">
                  Additional Notes <span className="text-muted/40 font-normal normal-case">(optional)</span>
                </label>
                <textarea value={cancelNote} onChange={e => setCancelNote(e.target.value)}
                  rows={3} placeholder="Any additional information…"
                  className="w-full bg-white border-[1.5px] border-black/10 rounded-[9px] px-3.5 py-3 text-[14px] text-navy placeholder:text-muted/50 focus:outline-none focus:border-orange transition-colors resize-none" />
              </div>

              {error && <ErrorBanner message={error} className="mb-4" />}

              <button onClick={handleConfirmCancel} disabled={!selectedReason || cancelling}
                className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-[9px] py-3.5 font-syne font-bold text-[14px] flex items-center justify-center gap-2 transition-colors">
                {cancelling && <Loader2 size={15} className="animate-spin" />}
                {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
              </button>
            </div>
          )}

          {/* ── CANCELLED ── */}
          {step === 'cancelled' && (
            <div className="px-5 py-10 text-center">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <h4 className="font-syne font-bold text-navy text-[17px] mb-2">Booking Cancelled</h4>
              <p className="text-muted text-[13.5px] leading-[1.7] mb-4 max-w-[320px] mx-auto">
                Your booking <strong>{refDisplay}</strong> has been successfully cancelled.
              </p>
              {depositPaid > 0 && (
                <div className={cn(
                  'rounded-[10px] px-4 py-3 mb-6 text-[13px] leading-[1.6] max-w-[340px] mx-auto text-left',
                  refundSuccess
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-orange/[0.07] border border-orange/20 text-orange/90'
                )}>
                  {refundSuccess ? (
                    <>✅ Your deposit of <strong>${depositPaid.toFixed(2)}</strong> has been submitted for refund. It may take 5–10 business days to appear on your card.</>
                  ) : (
                    <>💳 Your deposit of <strong>${depositPaid.toFixed(2)}</strong> will be refunded by our team shortly. You'll receive a confirmation once processed.</>
                  )}
                </div>
              )}
              <button onClick={onClose}
                className="bg-navy hover:bg-navy-mid text-white font-syne font-bold text-[13px] px-8 py-3 rounded-full transition-colors">
                Close
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
