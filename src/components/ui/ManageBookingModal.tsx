'use client'

import { useEffect, useRef } from 'react'
import { X, CalendarCheck, Search } from 'lucide-react'

interface ManageBookingModalProps {
  open: boolean
  onClose: () => void
}

export default function ManageBookingModal({ open, onClose }: ManageBookingModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)

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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-off-white border border-black/10 rounded-card w-full max-w-[460px] overflow-hidden animate-modal-in">
        {/* Header */}
        <div className="bg-white border-b border-black/[0.08] px-[22px] py-[18px] flex items-center justify-between">
          <h3 className="font-syne font-bold text-[16px] text-navy flex items-center gap-2">
            <CalendarCheck size={16} className="text-orange" />
            Manage My Booking
          </h3>
          <button
            onClick={onClose}
            className="text-muted text-xl transition-colors hover:text-navy"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-[22px] py-6">
          <p className="text-muted text-[13.5px] leading-[1.65] mb-5">
            Enter your confirmation number and last name to view or modify your reservation.
          </p>

          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.8px] mb-1.5">
              Confirmation Number
            </label>
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. RCM-12345"
              className="w-full bg-white border-[1.5px] border-black/10 rounded-[9px] px-3.5 py-3 text-[14px] text-navy font-dm placeholder:text-muted/60 focus:outline-none focus:border-orange transition-colors"
            />
          </div>

          <div className="mb-6">
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.8px] mb-1.5">
              Renter Last Name
            </label>
            <input
              type="text"
              placeholder="e.g. Smith"
              className="w-full bg-white border-[1.5px] border-black/10 rounded-[9px] px-3.5 py-3 text-[14px] text-navy font-dm placeholder:text-muted/60 focus:outline-none focus:border-orange transition-colors"
            />
          </div>

          <button className="w-full bg-navy hover:bg-navy-mid text-white rounded-[9px] py-3.5 font-syne font-bold text-[15px] flex items-center justify-center gap-2 transition-colors">
            <Search size={15} />
            Find My Booking
          </button>
        </div>
      </div>
    </div>
  )
}
