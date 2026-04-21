import { getTranslations } from 'next-intl/server'
import { ArrowRight, MapPin, Phone, Mail } from 'lucide-react'
import { Link } from '@/i18n/navigation'

export const metadata = {
  title: 'About Us | YITU Car Rental',
  description: 'Learn about YITU Car Rental — New Zealand-based, dedicated to reliable, comfortable and affordable transportation.',
}

export default async function AboutPage() {
  const t = await getTranslations()

  return (
    <main className="min-h-screen bg-off-white pt-24 pb-20">
      {/* Hero */}
      <section className="bg-navy py-16 px-10">
        <div className="max-w-[860px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-[11px] text-orange uppercase tracking-[2.5px] font-bold mb-4">
            <span className="w-5 h-0.5 bg-orange inline-block" />
            {t('AboutPage.kicker')}
          </div>
          <h1 className="font-montserrat font-extrabold italic text-[clamp(2rem,4vw,3.2rem)] text-white leading-[1.1] mb-4">
            {t('AboutPage.titlePrefix')} <span className="text-orange">{t('AboutPage.titleAccent')}</span> {t('AboutPage.titleSuffix')}
          </h1>
          <p className="text-white/60 text-[15px] leading-[1.8] max-w-[600px] mx-auto">
            {t('AboutPage.subtitle')}
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="py-16 px-10">
        <div className="max-w-[860px] mx-auto">

          {/* About card */}
          <div className="bg-white border border-black/10 rounded-[16px] p-8 md:p-12 mb-8 shadow-sm">
            <h2 className="font-syne font-extrabold text-[1.4rem] text-navy mb-5">{t('AboutPage.ourStory')}</h2>
            <p className="text-[15px] text-muted leading-[1.85] mb-5">
              {t('AboutPage.story.p1')}
            </p>
            <p className="text-[15px] text-muted leading-[1.85] mb-5">
              {t('AboutPage.story.p2')}
            </p>
            <p className="text-[15px] text-muted leading-[1.85]">
              {t('AboutPage.story.p3')}
            </p>
          </div>

          {/* Values grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {[
              {
                title: t('AboutPage.values.reliability.title'),
                body: t('AboutPage.values.reliability.body'),
              },
              {
                title: t('AboutPage.values.transparency.title'),
                body: t('AboutPage.values.transparency.body'),
              },
              {
                title: t('AboutPage.values.customerFirst.title'),
                body: t('AboutPage.values.customerFirst.body'),
              },
            ].map((v) => (
              <div key={v.title} className="bg-white border border-black/10 rounded-[14px] p-6 shadow-sm">
                <div className="w-8 h-0.5 bg-orange mb-3" />
                <h3 className="font-syne font-bold text-navy text-[15px] mb-2">{v.title}</h3>
                <p className="text-[13.5px] text-muted leading-[1.7]">{v.body}</p>
              </div>
            ))}
          </div>

          {/* Contact info */}
          <div className="bg-navy rounded-[16px] p-8 md:p-10 text-white">
            <h2 className="font-syne font-bold text-[1.1rem] mb-6">{t('AboutPage.getInTouch')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
              <a href="tel:0800948888" className="flex items-start gap-3 group">
                <Phone size={16} className="text-orange mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] text-white/40 uppercase tracking-wide mb-0.5">{t('AboutPage.phone')}</div>
                  <div className="text-[14px] text-white/80 group-hover:text-white transition-colors">0800 948 888</div>
                </div>
              </a>
              <a href="mailto:booking@yiturentalcars.co.nz" className="flex items-start gap-3 group">
                <Mail size={16} className="text-orange mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] text-white/40 uppercase tracking-wide mb-0.5">{t('AboutPage.email')}</div>
                  <div className="text-[14px] text-white/80 group-hover:text-white transition-colors">booking@yiturentalcars.co.nz</div>
                </div>
              </a>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-orange mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] text-white/40 uppercase tracking-wide mb-0.5">{t('AboutPage.address')}</div>
                  <div className="text-[14px] text-white/80">{t('AboutPage.addressValue')}</div>
                </div>
              </div>
            </div>
            <Link
              href="/booking/vehicles"
              className="inline-flex items-center gap-2 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-6 py-3 rounded-full transition-all hover:scale-[1.03] shadow-orange-glow"
            >
              {t('AboutPage.bookVehicle')} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
