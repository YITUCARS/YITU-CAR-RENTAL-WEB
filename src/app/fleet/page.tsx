'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search } from 'lucide-react'
import { vehicleRepo } from '@/lib/db'
import type { VehicleRecord } from '@/lib/db'
import { VEHICLE_CATEGORIES } from '@/lib/data'
import { cn } from '@/lib/utils'
import VehicleCard from '@/components/ui/VehicleCard'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ManageBookingModal from '@/components/ui/ManageBookingModal'

export default function FleetPage() {
    const router = useRouter()
    const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
    const [activeCategory, setActiveCategory] = useState('all')
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)

    useEffect(() => {
        vehicleRepo.getActive().then(setVehicles)
    }, [])

    const filtered = vehicles
        .filter((v) => activeCategory === 'all' || v.category === activeCategory)
        .filter((v) =>
            search === '' ||
            v.brand.toLowerCase().includes(search.toLowerCase()) ||
            v.model.toLowerCase().includes(search.toLowerCase())
        )

    const scrollToBooking = () => {
        router.push('/#booking')
    }

    return (
        <>
            <Navbar onManageBooking={() => setModalOpen(true)} />
            <ManageBookingModal open={modalOpen} onClose={() => setModalOpen(false)} />

            {/* Hero */}
            <div className="pt-[80px] bg-navy">
                <div className="max-w-[1100px] mx-auto px-10 py-14">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-6 transition-colors"
                    >
                        <ArrowLeft size={14} /> Back to Home
                    </button>
                    <div className="flex items-center gap-2 text-[11.5px] text-orange uppercase tracking-[2.5px] font-bold mb-3 before:content-[''] before:w-5 before:h-0.5 before:bg-orange">
                        Our Fleet
                    </div>
                    <h1 className="font-syne font-extrabold text-white text-[clamp(2rem,4vw,3rem)] leading-tight mb-3">
                        All <span className="text-orange">Vehicles</span>
                    </h1>
                    <p className="text-white/60 text-[15px] max-w-[500px]">
                        {vehicles.length} vehicles available — unlimited kilometres, comprehensive insurance included.
                    </p>
                </div>
            </div>

            {/* Filters + Search */}
            <div className="sticky top-[64px] z-40 bg-white border-b border-black/10 px-10 py-4">
                <div className="max-w-[1100px] mx-auto flex flex-wrap items-center gap-3">
                    {/* Category filters */}
                    <div className="flex gap-1.5 flex-wrap">
                        {VEHICLE_CATEGORIES.map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setActiveCategory(value)}
                                className={cn(
                                    'bg-off-white border border-black/10 text-muted text-[12.5px] px-4 py-1.5 rounded-full transition-all font-dm font-medium',
                                    activeCategory === value && 'bg-orange border-orange text-white font-semibold'
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="ml-auto flex items-center gap-2 bg-off-white border border-black/10 rounded-full px-4 py-1.5 focus-within:border-orange transition-colors">
                        <Search size={13} className="text-muted" />
                        <input
                            type="text"
                            placeholder="Search brand or model..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-transparent text-[13px] text-navy outline-none w-48 placeholder:text-muted"
                        />
                    </div>

                    {/* Result count */}
                    <div className="text-[12px] text-muted">
                        {filtered.length} vehicles
                    </div>
                </div>
            </div>

            {/* Grid */}
            <main className="max-w-[1100px] mx-auto px-10 py-12">
                {filtered.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
                        {filtered.map((vehicle) => (
                            <VehicleCard
                                key={vehicle.id}
                                vehicle={vehicle}
                                onBook={scrollToBooking}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-muted">
                        No vehicles found.
                    </div>
                )}
            </main>

            <Footer onManageBooking={() => setModalOpen(true)} />
        </>
    )
}