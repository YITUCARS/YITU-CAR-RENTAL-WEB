'use client'

import { useState } from 'react'
import { ArrowRight, Check, ChevronDown, Heart, Mail, Phone } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ManageBookingModal from '@/components/ui/ManageBookingModal'
import WeddingHeroHotspots from '@/components/wedding/WeddingHeroHotspots'
import WeddingEnquiryModal from '@/components/wedding/WeddingEnquiryModal'
import { WEDDING_SERVICES } from '@/components/wedding/weddingServices'
import { WEDDING_FLEET } from '@/components/wedding/weddingFleet'

type Props = {
    kicker: string
    title: string
    subtitle: string
    cta: string
    back: string
    serviceTitle: string
    serviceBody: string
    points: string[]
    contactTitle: string
    contactBody: string
}

type EnquiryState = { open: boolean; vehicleIds: string[]; serviceIds: string[] }

const CLOSED_ENQUIRY: EnquiryState = { open: false, vehicleIds: [], serviceIds: [] }

export default function WeddingPageShell(props: Props) {
    const [manageOpen, setManageOpen] = useState(false)
    const [enquiry, setEnquiry] = useState<EnquiryState>(CLOSED_ENQUIRY)

    // This page stays off the booking engine: every call to action either moves down
    // the page or opens the enquiry form.
    const scrollTo = (id: string) => {
        const target = document.getElementById(id)
        if (!target) return
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' })
    }

    const openEnquiry = (vehicleIds: string[] = [], serviceIds: string[] = []) => setEnquiry({ open: true, vehicleIds, serviceIds })

    return (
        <>
            <Navbar overlay onManageBooking={() => setManageOpen(true)} />
            <ManageBookingModal open={manageOpen} onClose={() => setManageOpen(false)} />
            <WeddingEnquiryModal
                open={enquiry.open}
                onClose={() => setEnquiry(CLOSED_ENQUIRY)}
                vehicles={WEDDING_FLEET}
                initialVehicleIds={enquiry.vehicleIds}
                initialServiceIds={enquiry.serviceIds}
            />

            <main className="bg-[#080d18]">
                <section data-nav-overlay-anchor className="relative min-h-[560px] overflow-hidden bg-[#101c35] md:min-h-[100svh]">
                    <div className="absolute inset-0 bg-[url('/wedding-hero.webp')] bg-cover bg-center bg-no-repeat" aria-hidden="true" />
                    <WeddingHeroHotspots onSelect={() => scrollTo('wedding-fleet')} />

                    {/* Softens the cut between the photograph and the dark page below it. */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[32vh] bg-[linear-gradient(180deg,rgba(8,13,24,0)_0%,rgba(8,13,24,0.35)_45%,rgba(8,13,24,0.82)_78%,#080d18_100%)]" aria-hidden="true" />

                    <button
                        type="button"
                        onClick={() => scrollTo('wedding-fleet')}
                        className="group absolute inset-x-0 bottom-[7vh] z-20 mx-auto flex w-max max-w-[92vw] flex-col items-center gap-4 px-6 py-2"
                    >
                        <span className="wedding-hero-cta font-montserrat text-[clamp(1.15rem,2.2vw,1.95rem)] font-extrabold italic leading-none [text-shadow:0_2px_18px_rgba(0,0,0,0.45)]">Choose your wedding car</span>
                        <ChevronDown className="wedding-hero-arrow text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:translate-y-1" size={30} strokeWidth={1.5} />
                    </button>
                </section>

                {/* Everything below the hero runs dark so the fleet photography carries the page. */}
                <section className="relative overflow-hidden">
                    <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange/10 blur-[140px]" aria-hidden="true" />
                    <div className="relative mx-auto max-w-[1100px] px-6 py-20 sm:px-10 lg:py-28">
                        <div className="mx-auto max-w-[760px] text-center">
                            <div className="mb-4 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-orange"><Heart size={13} /> {props.kicker}</div>
                            <h2 className="font-display text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[1.12] text-white">{props.serviceTitle}</h2>
                            <p className="mx-auto mt-5 max-w-[640px] text-[14.5px] leading-[1.9] text-white/55">{props.serviceBody}</p>
                        </div>
                        <div className="mt-10 grid gap-4 sm:grid-cols-2">
                            {props.points.map(point => (
                                <div key={point} className="flex items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4 text-center text-[13px] leading-relaxed text-white/75">
                                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange/15 text-orange"><Check size={13} /></span>
                                    {point}
                                </div>
                            ))}
                        </div>

                        <div id="wedding-fleet" className="mt-20 scroll-mt-32">
                            <div className="mb-9 text-center">
                                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange">YITU Wedding Collection</div>
                                <h2 className="mt-2 font-display text-[clamp(1.7rem,3vw,2.6rem)] font-semibold text-white">Premium wedding vehicles</h2>
                                <div className="mt-3 text-[11px] uppercase tracking-[0.14em] text-white/35">{WEDDING_FLEET.length} curated vehicles</div>
                            </div>
                            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                {WEDDING_FLEET.map(car => (
                                    <article key={car.id} className="group flex flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#111620] transition-all hover:-translate-y-1 hover:border-orange/40">
                                        {/* Studio shots come on white: the photo stays untouched and the white
                                            spills down past it, fading out into the card below. */}
                                        <div className="relative mx-px mt-px h-[206px] overflow-hidden rounded-t-[22px] bg-white pt-[38px] [transform:translateZ(0)]">
                                            <img src={car.image} alt={`${car.name} decorated for a wedding`} loading="lazy" className="h-full w-full object-cover object-[center_42%]" />
                                            {/* Guarantees the hand-off to the fade below starts from pure white. */}
                                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52px] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.75)_55%,#ffffff_100%)]" aria-hidden="true" />
                                            <span className="absolute left-4 top-4 rounded-full bg-[#111620]/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm">{car.body}</span>
                                        </div>
                                        <div className="relative flex flex-1 flex-col px-6 pb-7 pt-[108px] text-center">
                                            {/* 16-stop ease-out ramp, plus a dither layer so the long fade cannot band. */}
                                            <div className="pointer-events-none absolute inset-x-px top-0 h-[182px] bg-[linear-gradient(180deg,#ffffff_0%,rgba(255,255,255,0.874)_6%,rgba(255,255,255,0.759)_12%,rgba(255,255,255,0.652)_18%,rgba(255,255,255,0.535)_25%,rgba(255,255,255,0.434)_32%,rgba(255,255,255,0.342)_39%,rgba(255,255,255,0.262)_46%,rgba(255,255,255,0.192)_53%,rgba(255,255,255,0.133)_60%,rgba(255,255,255,0.086)_67%,rgba(255,255,255,0.05)_74%,rgba(255,255,255,0.025)_81%,rgba(255,255,255,0.009)_88%,rgba(255,255,255,0.002)_94%,rgba(255,255,255,0)_100%)]" aria-hidden="true" />
                                            <div className="wedding-fade-dither pointer-events-none absolute inset-x-px top-0 h-[182px]" aria-hidden="true" />
                                            <h3 className="relative font-syne text-[17px] font-extrabold text-white">{car.name}</h3>
                                            <p className="mt-3 flex-1 text-[12.5px] leading-[1.8] text-white/50">{car.note}</p>
                                            <button type="button" onClick={() => openEnquiry([car.id])} className="mx-auto mt-6 flex items-center gap-1.5 rounded-xl bg-orange px-5 py-2.5 text-[11.5px] font-bold text-white transition-all hover:bg-orange-dark">Enquire <ArrowRight size={13} /></button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section id="wedding-services" className="relative scroll-mt-32 border-y border-white/[0.07] bg-[#0b1322]">
                    <div className="mx-auto max-w-[1100px] px-6 py-20 sm:px-10 lg:py-28">
                        <div className="mx-auto max-w-[760px] text-center">
                            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange">Beyond the car</div>
                            <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[1.12] text-white">Our wedding services</h2>
                            <p className="mx-auto mt-5 max-w-[660px] text-[14.5px] leading-[1.9] text-white/55">Everything around the car can be arranged with it — decoration, a chauffeur, a car for your photographer, a matched convoy for the bridal party. Choose what you need and we will quote it as one package.</p>
                        </div>

                        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                            {WEDDING_SERVICES.map(service => {
                                const Icon = service.icon
                                return (
                                    <article key={service.id} className="group flex flex-col items-center rounded-[24px] border border-white/10 bg-white/[0.03] p-8 text-center transition-all hover:-translate-y-1 hover:border-orange/40 hover:bg-white/[0.06]">
                                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange/25 bg-orange/10 text-orange transition-colors group-hover:bg-orange group-hover:text-white"><Icon size={20} strokeWidth={1.6} /></span>
                                        <h3 className="mt-6 font-display text-[21px] font-semibold leading-snug text-white">{service.title}</h3>
                                        <p className="mt-3 flex-1 text-[13px] leading-[1.85] text-white/50">{service.detail}</p>
                                        <button type="button" onClick={() => openEnquiry([], [service.id])} className="mt-6 flex items-center gap-1.5 text-[12px] font-bold text-orange transition-all hover:gap-2.5">Add to enquiry <ArrowRight size={13} /></button>
                                    </article>
                                )
                            })}
                        </div>
                    </div>
                </section>

                <section id="wedding-contact" className="scroll-mt-32 px-6 py-20 sm:px-10 lg:py-28">
                    <div className="relative mx-auto max-w-[960px] overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#16203a] via-[#101829] to-[#0b1220] p-10 text-center sm:p-14">
                        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-orange/20 blur-[100px]" aria-hidden="true" />
                        <div className="relative">
                            <h2 className="font-display text-[clamp(1.9rem,3.4vw,2.9rem)] font-semibold leading-tight text-white">{props.contactTitle}</h2>
                            <p className="mx-auto mt-4 max-w-[620px] text-[14px] leading-[1.9] text-white/55">{props.contactBody}</p>
                            <button type="button" onClick={() => openEnquiry()} className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-orange px-8 py-4 font-syne text-[13.5px] font-bold text-white transition-all hover:bg-orange-dark hover:shadow-orange-glow">Start your enquiry <ArrowRight size={15} /></button>
                            <div className="mt-8 flex flex-wrap justify-center gap-3 text-[12px] font-bold text-white/70">
                                <a href="mailto:booking@yiturentalcars.co.nz" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition-colors hover:border-white/25 hover:text-white"><Mail size={14} className="text-orange" /> booking@yiturentalcars.co.nz</a>
                                <a href="tel:+64800948888" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition-colors hover:border-white/25 hover:text-white"><Phone size={14} className="text-orange" /> 0800 948 888</a>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <div className="footer-dark">
                <Footer onManageBooking={() => setManageOpen(true)} />
            </div>
        </>
    )
}
