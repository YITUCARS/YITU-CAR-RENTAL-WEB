'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ManageBookingModal from '@/components/ui/ManageBookingModal'
import GallerySection from '@/components/sections/GallerySection'

export default function GalleryPage() {
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      <Navbar onManageBooking={() => setModalOpen(true)} />
      <ManageBookingModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <main className="pt-[120px]">
        <GallerySection />
      </main>

      <Footer onManageBooking={() => setModalOpen(true)} />
    </>
  )
}
