'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ManageBookingModal from '@/components/ui/ManageBookingModal'

interface Section {
  id: string
  title: string
  content: React.ReactNode
}

interface LegalPageLayoutProps {
  badge: string
  title: string
  subtitle: string
  lastUpdated: string
  sections: Section[]
  tocLinks: { id: string; label: string }[]
}

export default function LegalPageLayout({
  badge,
  title,
  subtitle,
  lastUpdated,
  sections,
  tocLinks,
}: LegalPageLayoutProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const t = useTranslations()

  return (
    <>
      <Navbar onManageBooking={() => setModalOpen(true)} />
      <ManageBookingModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Hero */}
      <div className="min-h-screen bg-white font-dm">
      <div className="pt-[120px] bg-navy text-white">
        <div className="max-w-[900px] mx-auto px-10 py-16">
          <div className="inline-flex items-center gap-2 bg-orange/15 border border-orange/30 text-orange text-[11px] font-medium px-3 py-1.5 rounded-full mb-5">
            {badge}
          </div>
          <h1 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] leading-tight mb-4">
            {title}
          </h1>
          <p className="text-white/65 text-[15px] leading-relaxed max-w-[560px] mb-6">
            {subtitle}
          </p>
          <div className="text-[12px] text-white/40 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange inline-block" />
            {lastUpdated}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-[900px] mx-auto px-10 py-16 flex gap-12 items-start">
        {/* TOC — sticky sidebar */}
        <aside className="hidden lg:block w-[220px] flex-shrink-0 sticky top-[130px]">
          <div className="bg-off-white border border-black/10 rounded-card p-5">
            <div className="text-[11px] font-bold text-muted uppercase tracking-[1.5px] mb-4">
              {t('Legal.contents')}
            </div>
            <nav className="flex flex-col gap-1">
              {tocLinks.map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  className="flex items-center gap-1.5 text-[12.5px] text-muted hover:text-orange transition-colors py-1"
                >
                  <ChevronRight size={10} className="flex-shrink-0" />
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="mb-12 scroll-mt-24">
              <h2 className="font-syne font-bold text-[1.25rem] text-navy mb-4 pb-3 border-b border-black/10 flex items-center gap-2">
                <span className="w-1 h-5 bg-orange rounded-full flex-shrink-0" />
                {section.title}
              </h2>
              <div className="prose-legal">{section.content}</div>
            </section>
          ))}

          {/* Back to top */}
          <div className="mt-10 pt-8 border-t border-black/10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-navy text-white font-syne font-bold text-[13px] px-6 py-3 rounded-full hover:bg-navy-mid transition-colors"
            >
              ← {t('Legal.returnHome')}
            </Link>
          </div>
        </main>
      </div>
      </div>

      <Footer onManageBooking={() => setModalOpen(true)} />
    </>
  )
}
