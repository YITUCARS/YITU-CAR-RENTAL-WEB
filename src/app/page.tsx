'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ManageBookingModal from '@/components/ui/ManageBookingModal'
import HeroSection from '@/components/sections/HeroSection'
import BookingSection from '@/components/sections/BookingSection'
import StatsStrip from '@/components/sections/StatsStrip'
import FleetSection from '@/components/sections/FleetSection'
import DealsSection from '@/components/sections/DealsSection'
import TrustSection from '@/components/sections/TrustSection'
import LocationsSection from '@/components/sections/LocationsSection'
import ContactSection from '@/components/sections/ContactSection'
import CTASplitSection from '@/components/sections/CTASplitSection'
//顶部 import 区加上
import ReviewsSection from '@/components/sections/ReviewsSection'

export default function HomePage() {
  const [modalOpen, setModalOpen] = useState(false)

  // Scroll-reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('in')
        })
      },
      { threshold: 0.1 }
    )
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <Navbar onManageBooking={() => setModalOpen(true)} />
      <ManageBookingModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <main>
        {/* Hero */}
        <HeroSection />
        {/* Booking form */}
        <BookingSection />

        {/* Stats strip */}
        <StatsStrip />

        {/* Fleet */}
        <div className="reveal">
          <FleetSection />
        </div>

        {/* Hot Deals */}
        <div className="reveal">
          <DealsSection />
        </div>

        {/* 加在这里 👇 */}
        <div className="reveal">
          <ReviewsSection />
        </div>

        <div className="reveal">
          <LocationsSection />
        </div>

        {/* Contact / WeChat */}
        <div className="reveal">
          <ContactSection />
        </div>

        {/* CTA split */}
        <div className="reveal">
          <CTASplitSection />
        </div>
      </main>

      <Footer onManageBooking={() => setModalOpen(true)} />
    </>
  )
}
