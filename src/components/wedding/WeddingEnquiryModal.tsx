'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Mail, Send, X } from 'lucide-react'
import { WEDDING_SERVICES } from '@/components/wedding/weddingServices'
import type { WeddingFleetCar } from '@/components/wedding/weddingFleet'

type Props = {
    open: boolean
    onClose: () => void
    vehicles: WeddingFleetCar[]
    initialVehicleIds?: string[]
    initialServiceIds?: string[]
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

const EMPTY_FORM = { name: '', email: '', phone: '', weddingDate: '', location: '', message: '', company: '' }

export default function WeddingEnquiryModal({ open, onClose, vehicles, initialVehicleIds, initialServiceIds }: Props) {
    const [form, setForm] = useState(EMPTY_FORM)
    const [vehicleIds, setVehicleIds] = useState<string[]>([])
    const [serviceIds, setServiceIds] = useState<string[]>([])
    const [status, setStatus] = useState<Status>('idle')
    const [error, setError] = useState('')
    const nameRef = useRef<HTMLInputElement>(null)

    // Each opening starts from whatever the visitor clicked (a car, or a service card).
    useEffect(() => {
        if (!open) return
        setVehicleIds(initialVehicleIds ?? [])
        setServiceIds(initialServiceIds ?? [])
        setStatus('idle')
        setError('')
        const focusTimer = setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 120)
        return () => clearTimeout(focusTimer)
    }, [open, initialVehicleIds, initialServiceIds])

    useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onKeyDown)
        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [open, onClose])

    if (!open) return null

    const toggle = (list: string[], setList: (next: string[]) => void, id: string) => {
        setList(list.includes(id) ? list.filter(item => item !== id) : [...list, id])
    }

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        setStatus('sending')
        setError('')

        try {
            const response = await fetch('/api/wedding/enquiry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    vehicles: vehicleIds.map(id => vehicles.find(item => item.id === id)?.name ?? id),
                    services: serviceIds.map(id => WEDDING_SERVICES.find(service => service.id === id)?.title ?? id),
                }),
            })

            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
                setError(data.error || 'Something went wrong. Please try again.')
                setStatus('error')
                return
            }

            setStatus('sent')
            setForm(EMPTY_FORM)
        } catch {
            setError('Network error. Please check your connection and try again.')
            setStatus('error')
        }
    }

    const field = 'w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-[13.5px] text-white placeholder:text-white/35 outline-none transition-colors focus:border-orange/70 focus:bg-white/[0.07]'
    const label = 'mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/45'

    return (
        <div className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-8" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Wedding enquiry"
                className="animate-modal-in relative my-auto w-full max-w-[720px] overflow-hidden rounded-[26px] border border-white/12 bg-[#0d1424] shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
                onClick={event => event.stopPropagation()}
            >
                <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-white/60 transition-colors hover:border-white/30 hover:text-white">
                    <X size={16} />
                </button>

                {status === 'sent' ? (
                    <div className="px-8 py-16 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange/15 text-orange"><Check size={26} /></div>
                        <h3 className="mt-5 font-display text-[26px] font-semibold text-white">Enquiry sent</h3>
                        <p className="mx-auto mt-3 max-w-[380px] text-[13.5px] leading-relaxed text-white/55">Thank you — our wedding team will come back to you shortly with availability and a tailored quote.</p>
                        <button type="button" onClick={onClose} className="mt-7 rounded-xl border border-white/15 px-6 py-3 text-[12.5px] font-bold text-white/80 transition-colors hover:border-white/35 hover:text-white">Close</button>
                    </div>
                ) : (
                    <form onSubmit={submit} className="max-h-[86vh] overflow-y-auto">
                        <div className="border-b border-white/10 px-7 py-6 sm:px-9">
                            <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-orange">Wedding enquiry</div>
                            <h3 className="mt-2 font-display text-[26px] font-semibold leading-tight text-white sm:text-[30px]">Tell us about your day</h3>
                            <p className="mt-2 text-[13px] leading-relaxed text-white/50">Pick the cars and services you are interested in — we will reply with availability and a tailored quote. No booking is made from this form.</p>
                        </div>

                        <div className="space-y-7 px-7 py-7 sm:px-9">
                            <div>
                                <div className={label}>Vehicles you are interested in</div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {vehicles.length === 0 && <p className="text-[13px] text-white/40">Tell us below which style of car you have in mind.</p>}
                                    {vehicles.map(vehicle => {
                                        const active = vehicleIds.includes(vehicle.id)
                                        return (
                                            <button
                                                type="button"
                                                key={vehicle.id}
                                                onClick={() => toggle(vehicleIds, setVehicleIds, vehicle.id)}
                                                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${active ? 'border-orange/60 bg-orange/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
                                            >
                                                <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${active ? 'border-orange bg-orange text-white' : 'border-white/25'}`} style={{ height: 18, width: 18 }}>
                                                    {active && <Check size={12} />}
                                                </span>
                                                <span className="text-[13px] font-semibold text-white">{vehicle.name}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div>
                                <div className={label}>Services you need</div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {WEDDING_SERVICES.map(service => {
                                        const active = serviceIds.includes(service.id)
                                        const Icon = service.icon
                                        return (
                                            <button
                                                type="button"
                                                key={service.id}
                                                onClick={() => toggle(serviceIds, setServiceIds, service.id)}
                                                className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${active ? 'border-orange/60 bg-orange/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
                                            >
                                                <span className={`mt-0.5 flex shrink-0 items-center justify-center rounded-[5px] border transition-colors ${active ? 'border-orange bg-orange text-white' : 'border-white/25'}`} style={{ height: 18, width: 18 }}>
                                                    {active && <Check size={12} />}
                                                </span>
                                                <span>
                                                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white"><Icon size={13} className="text-orange" /> {service.title}</span>
                                                    <span className="mt-0.5 block text-[11.5px] text-white/45">{service.blurb}</span>
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={label} htmlFor="wedding-name">Your name *</label>
                                    <input id="wedding-name" ref={nameRef} required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className={field} placeholder="Jane & Alex" />
                                </div>
                                <div>
                                    <label className={label} htmlFor="wedding-email">Email *</label>
                                    <input id="wedding-email" type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className={field} placeholder="you@example.com" />
                                </div>
                                <div>
                                    <label className={label} htmlFor="wedding-phone">Phone</label>
                                    <input id="wedding-phone" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className={field} placeholder="+64 …" />
                                </div>
                                <div>
                                    <label className={label} htmlFor="wedding-date">Wedding date</label>
                                    <input id="wedding-date" type="date" value={form.weddingDate} onChange={event => setForm({ ...form, weddingDate: event.target.value })} className={`${field} [color-scheme:dark]`} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className={label} htmlFor="wedding-location">Pick-up address or venue</label>
                                    <input id="wedding-location" value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} className={field} placeholder="Christchurch · venue name" />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className={label} htmlFor="wedding-message">Anything else we should know</label>
                                    <textarea id="wedding-message" rows={4} value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} className={`${field} resize-none`} placeholder="Timings, number of guests, colour palette, decoration ideas…" />
                                </div>
                            </div>

                            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.company} onChange={event => setForm({ ...form, company: event.target.value })} className="pointer-events-none absolute h-0 w-0 opacity-0" />

                            {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-[12.5px] text-red-200">{error}</p>}

                            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
                                <a href="mailto:booking@yiturentalcars.co.nz" className="flex items-center gap-2 text-[12px] font-semibold text-white/45 transition-colors hover:text-white"><Mail size={13} className="text-orange" /> booking@yiturentalcars.co.nz</a>
                                <button type="submit" disabled={status === 'sending'} className="flex items-center gap-2 rounded-xl bg-orange px-6 py-3.5 font-syne text-[13px] font-bold text-white transition-all hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-60">
                                    {status === 'sending' ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <>Send enquiry <Send size={14} /></>}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
