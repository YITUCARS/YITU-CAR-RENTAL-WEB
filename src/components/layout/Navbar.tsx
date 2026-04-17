'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, CalendarCheck, Search } from 'lucide-react'
import { NAV_LINKS } from '@/lib/data'
import { cn } from '@/lib/utils'

interface NavbarProps {
  onManageBooking: () => void
}

export default function Navbar({ onManageBooking }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const isHomePage = pathname === '/'

  const resolveNavHref = (href: string) => {
    if (href.startsWith('#')) return isHomePage ? href : `/${href}`
    return href
  }

  const goToBooking = () => {
    router.push('/booking/vehicles')
    setMobileOpen(false)
  }

  return (
    <>
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-navy h-8 flex items-center justify-center gap-8 px-10">
        <a
            href="tel:+6421234567"
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-[12px] font-medium transition-colors"
        >
          📞 +64 800 948 888
        </a>

        <span className="text-white/20 text-[10px]">|</span>

        <a
            href="mailto:info@yitucarrental.co.nz"
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-[12px] font-medium transition-colors"
        >
          ✉️ booking@yiturentalcars.co.nz
        </a>

        <span className="text-white/20 text-[10px]">|</span>

        <a
            href="mailto:info@yitucarrental.co.nz"
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-[12px] font-medium transition-colors"
        >
          ⏰ Monday - Sunday 08:30 - 17:30
        </a>
      </div>

      <nav
        className={cn(
          'fixed top-8 left-0 right-0 z-50 flex items-center justify-between px-10 py-3.5 transition-all duration-300',
          'bg-navy/94 backdrop-blur-lg border-b border-white/[0.09]',
          scrolled && 'shadow-lg'
        )}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/YITU_Car_rental_Logo.png"
            alt="YITU Car Rental"
            width={120}
            height={36}
            className="h-9 w-auto brightness-110"
            priority
          />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-0.5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={resolveNavHref(link.href)}
              className="text-white/78 text-[13.5px] font-medium px-[15px] py-2 rounded-lg transition-all hover:text-white hover:bg-white/10"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA buttons */}
        <div className="hidden lg:flex items-center gap-3">
          <button
            onClick={onManageBooking}
            className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-white/60 text-navy px-[18px] py-2.5 rounded-full font-syne font-bold text-[12.5px] transition-all hover:bg-white hover:border-white"
          >
            <CalendarCheck size={13} />
            My Booking
          </button>
          <button
            onClick={goToBooking}
            className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-[22px] py-2.5 rounded-full transition-all hover:scale-[1.04] shadow-orange-glow"
          >
            <Search size={13} />
            Book Now
          </button>
        </div>

        {/* Hamburger */}
        <button
          className="lg:hidden flex flex-col gap-[5px] p-1"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <span className="block w-6 h-0.5 bg-white rounded" />
          <span className="block w-6 h-0.5 bg-white rounded" />
          <span className="block w-6 h-0.5 bg-white rounded" />
        </button>
      </nav>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-[280px] bg-white flex flex-col border-l border-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-[18px] border-b border-black/10">
              <Image
                src="/YITU_Car_rental_Logo.png"
                alt="YITU"
                width={90}
                height={28}
                className="h-7 w-auto"
              />
              <button
                onClick={() => setMobileOpen(false)}
                className="text-muted text-xl"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer links */}
            <div className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={resolveNavHref(link.href)}
                  onClick={() => setMobileOpen(false)}
                  className="block px-5 py-3.5 text-[14.5px] font-semibold text-muted border-b border-black/[0.07] hover:text-orange transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Drawer bottom */}
            <div className="mt-auto p-4 flex flex-col gap-2.5 border-t border-black/10">
              <button
                onClick={() => { onManageBooking(); setMobileOpen(false) }}
                className="w-full flex items-center justify-center gap-2 bg-off-white border border-black/10 text-navy font-syne font-bold text-sm py-3 rounded-full hover:border-navy transition-colors"
              >
                <CalendarCheck size={14} />
                Manage Booking
              </button>
              <button
                onClick={goToBooking}
                className="w-full flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-sm py-3 rounded-full transition-colors"
              >
                <Search size={14} />
                Book Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
