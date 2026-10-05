'use client'

import { useState } from 'react'
import { ArrowRight, BookOpen, Car } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ManageBookingModal from '@/components/ui/ManageBookingModal'
import { Link } from '@/i18n/navigation'
import RoadRulesSimulator from './RoadRulesSimulator'

const COPY = {
    en: {
        kicker: 'Driving in New Zealand',
        title: 'NZ road rules, animated',
        subtitle: 'Six situations that catch visitors out on New Zealand roads. Watch the right way, see the common mistake, and practise signalling at a roundabout.',
        checklistTitle: 'Before you set off',
        checklist: [
            'Drive on the left. The driver sits next to the centre line.',
            'Speed limits are in km/h: usually 100 on open roads and 50 in towns, lower where signposted.',
            'Everyone in the car must wear a seatbelt, and children need an approved child seat.',
            'You cannot hold or use a phone while driving.',
            'Carry your licence. If it is not in English, bring an approved translation or an International Driving Permit.',
            'At railway crossings, stop when the lights flash or a Stop sign is shown.',
        ],
        disclaimer: 'These animations are simplified illustrations. Always follow road signs and the official NZ Road Code from NZ Transport Agency Waka Kotahi.',
        ctaTitle: 'Ready to explore the South Island?',
        ctaBody: 'Pick up in Christchurch or Queenstown. Our team can talk you through the road rules at pick-up.',
        book: 'Book a car',
        guide: 'Read the full road rules guide',
    },
    zh: {
        kicker: '新西兰自驾',
        title: '新西兰交规动画演示',
        subtitle: '游客在新西兰自驾最容易出错的 6 个场景。先看正确做法，再看常见错误，还可以练习环岛怎么打灯。',
        checklistTitle: '出发前须知',
        checklist: [
            '靠左行驶，驾驶员一侧靠近道路中线。',
            '限速单位是公里/小时：开放道路一般 100，城镇一般 50，有标志的按标志执行。',
            '车上所有人都必须系安全带，儿童须使用合规的儿童座椅。',
            '驾驶时不能手持或使用手机。',
            '随身携带驾照。驾照不是英文的，须同时携带认可的翻译件或国际驾照。',
            '经过铁路道口时，信号灯闪烁或设有停车标志就必须停车。',
        ],
        disclaimer: '动画为简化示意。实际驾驶请以道路标志和新西兰交通局（NZ Transport Agency Waka Kotahi）发布的官方《道路规则》（Road Code）为准。',
        ctaTitle: '准备好出发游南岛了吗？',
        ctaBody: '可在基督城或皇后镇取车，取车时我们的工作人员也会为您讲解交规要点。',
        book: '立即订车',
        guide: '阅读完整交规指南',
    },
}

export default function RoadRulesPageShell({ locale }: { locale: 'en' | 'zh' }) {
    const [manageOpen, setManageOpen] = useState(false)
    const copy = COPY[locale]

    return (
        <>
            <Navbar onManageBooking={() => setManageOpen(true)} />
            <ManageBookingModal open={manageOpen} onClose={() => setManageOpen(false)} />

            <main className="min-h-screen bg-off-white pt-24">
                <section className="bg-navy px-4 pb-24 pt-14 text-white sm:px-10">
                    <div className="mx-auto max-w-[1100px]">
                        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-orange">{copy.kicker}</p>
                        <h1 className="mt-3 font-syne text-[34px] font-bold leading-tight sm:text-[46px]">{copy.title}</h1>
                        <p className="mt-4 max-w-[640px] text-[16px] leading-relaxed text-white/80">{copy.subtitle}</p>
                    </div>
                </section>

                <section className="-mt-16 px-4 sm:px-10">
                    <div className="mx-auto max-w-[1100px]">
                        <RoadRulesSimulator locale={locale} />
                        <p className="mt-4 text-[12.5px] leading-relaxed text-muted">{copy.disclaimer}</p>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-10">
                    <div className="mx-auto max-w-[1100px]">
                        <h2 className="font-syne text-[26px] font-bold text-navy">{copy.checklistTitle}</h2>
                        <ol className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-2">
                            {copy.checklist.map((item, i) => (
                                <li key={item} className="flex gap-4">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange/10 font-syne text-[14px] font-bold text-orange">{i + 1}</span>
                                    <span className="pt-1 text-[15px] leading-relaxed text-gray-700">{item}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <section className="px-4 pb-20 sm:px-10">
                    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 rounded-card bg-white p-8 shadow-card md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="font-syne text-[22px] font-bold text-navy">{copy.ctaTitle}</h2>
                            <p className="mt-2 max-w-[520px] text-[14.5px] leading-relaxed text-muted">{copy.ctaBody}</p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-full bg-orange px-6 py-3 text-[14px] font-bold text-white shadow-orange-glow transition-colors hover:bg-orange-dark">
                                <Car size={17} /> {copy.book}
                            </Link>
                            <Link href="/blog/nz-road-rules-for-visitors" className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold text-navy transition-colors hover:bg-navy/5">
                                <BookOpen size={17} /> {copy.guide} <ArrowRight size={15} />
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <Footer onManageBooking={() => setManageOpen(true)} />
        </>
    )
}
