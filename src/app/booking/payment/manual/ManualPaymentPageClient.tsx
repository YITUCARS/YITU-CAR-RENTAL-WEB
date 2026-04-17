'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { MessageCircle, CreditCard, Copy } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import BookingFlowHeader from '@/components/booking/BookingFlowHeader'

const WECHAT_ID = 'YituPrestigeCar'

export default function ManualPaymentPageClient() {
    const router = useRouter()
    const params = useSearchParams()

    const totalFromUrl = Number(params.get('total')) || 0
    const daysFromUrl = Number(params.get('days')) || 0

    async function copyWechatId() {
        try {
            await navigator.clipboard.writeText(WECHAT_ID)
        } catch {}
    }

    return (
        <>
            <Navbar onManageBooking={() => {}} />

            <BookingFlowHeader
                current={5}
                onBack={() => router.back()}
                summary={<div className="text-[13px] text-muted">WeChat / Alipay manual booking support</div>}
            />

            <main className="max-w-[900px] mx-auto px-10 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
                    <section className="bg-white border border-black/10 rounded-card p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-12 h-12 rounded-xl bg-[#07C160]/10 flex items-center justify-center">
                                <MessageCircle size={22} className="text-[#07C160]" />
                            </div>
                            <div>
                                <h1 className="font-syne font-extrabold text-[1.5rem] text-navy">Add Our WeChat</h1>
                                <p className="text-[13px] text-muted">Scan the QR code or add our customer service account to place your booking manually.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[3fr_2fr] gap-6 items-stretch mb-6">
                            <div className="rounded-[28px] border border-dashed border-black/15 bg-[#f7f9fc] overflow-hidden">
                                <div className="aspect-square w-full bg-white overflow-hidden p-0.5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                                    <Image
                                        src="/f41e600cbd0ea4695121c50896f17aab.jpg"
                                        alt="YITU WeChat QR code"
                                        width={600}
                                        height={600}
                                        className="w-full h-full object-contain scale-[1.06]"
                                    />
                                </div>
                            </div>

                            <div className="rounded-[28px] bg-[#f7f9fc] border border-black/10 overflow-hidden">
                                <div className="h-full bg-white px-6 py-8 flex flex-col items-center justify-center text-center shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                                    <div className="text-[10px] font-bold text-muted uppercase tracking-[0.22em] mb-3">WeChat ID</div>
                                    <div className="font-syne font-extrabold text-navy text-[17px] break-all leading-snug">
                                        {WECHAT_ID}
                                    </div>
                                    <button
                                        onClick={copyWechatId}
                                        className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 bg-off-white text-[12px] font-bold text-navy hover:border-orange hover:text-orange transition-colors"
                                    >
                                        <Copy size={14} />
                                        Copy WeChat ID
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-black/10 bg-white px-6 py-5">
                            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-4">
                                How It Works
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4 text-[13px] text-muted leading-[1.65]">
                                <div>
                                    <div className="font-bold text-navy text-[12px] mb-1.5">1 — Add WeChat</div>
                                    <p>Add our WeChat customer service using the ID above or by scanning the QR code.</p>
                                </div>
                                <div>
                                    <div className="font-bold text-navy text-[12px] mb-1.5">2 — Send Details</div>
                                    <p>Send your pick-up and drop-off details, vehicle choice, and preferred payment method.</p>
                                </div>
                                <div>
                                    <div className="font-bold text-navy text-[12px] mb-1.5">3 — Confirmation</div>
                                    <p>Our team will confirm availability and place the order for you manually.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <aside className="bg-white border border-black/10 rounded-card p-5 sticky top-24">
                        <h2 className="font-syne font-bold text-navy text-[15px] mb-4">Manual Booking Summary</h2>
                        <div className="space-y-2.5 text-[13px]">
                            <div className="flex justify-between text-muted">
                                <span>Payment method</span>
                                <span className="text-navy font-medium">WeChat / Alipay</span>
                            </div>
                            <div className="flex justify-between text-muted">
                                <span>Duration</span>
                                <span className="text-navy font-medium">{daysFromUrl} days</span>
                            </div>
                            <div className="flex justify-between text-muted">
                                <span>Status</span>
                                <span className="text-orange font-semibold">Manual confirmation</span>
                            </div>
                        </div>

                        <div className="border-t border-black/10 mt-4 pt-4">
                            <div className="flex items-center justify-between font-syne font-extrabold text-[18px] text-navy">
                                <span>Total</span>
                                <span className="text-orange">${totalFromUrl.toLocaleString()} NZD</span>
                            </div>
                            <div className="flex items-center gap-2 text-[12px] text-muted mt-3">
                                <CreditCard size={14} className="text-orange" />
                                WeChat Pay or Alipay will be arranged by our support team.
                            </div>
                        </div>
                    </aside>
                </div>
            </main>
        </>
    )
}