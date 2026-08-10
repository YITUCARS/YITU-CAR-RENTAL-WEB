import {ArrowRight, CheckCircle2, MapPin, Route, Search, ShieldCheck} from 'lucide-react'
import HomeClient from '@/app/HomeClient'
import type {SeoLandingPageData} from '@/lib/seo-landing-pages'

interface CarRentalLandingPageProps {
  page: SeoLandingPageData
}

export function carRentalLandingJsonLd(page: SeoLandingPageData) {
  const url = `https://www.yiturentalcars.co.nz/en/${page.slug}`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: page.metaTitle,
        description: page.description,
        inLanguage: 'en-NZ',
        about: {
          '@id': 'https://www.yiturentalcars.co.nz/#business',
        },
      },
      {
        '@type': 'CarRental',
        '@id': 'https://www.yiturentalcars.co.nz/#business',
        name: 'YITU Car Rental',
        url: 'https://www.yiturentalcars.co.nz/',
        telephone: '+64 3 3410109',
        email: 'booking@yiturentalcars.co.nz',
        areaServed: ['New Zealand', 'Christchurch', 'Queenstown', 'South Island'],
        address: {
          '@type': 'PostalAddress',
          streetAddress: '222 Main South Road, Hornby',
          addressLocality: 'Christchurch',
          postalCode: '8042',
          addressCountry: 'NZ',
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: page.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  }
}

export default function CarRentalLandingPage({page}: CarRentalLandingPageProps) {
  return (
    <HomeClient>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: JSON.stringify(carRentalLandingJsonLd(page))}}
      />

      <section className="relative overflow-hidden bg-off-white px-5 pb-20 pt-[150px] sm:px-10">
        <div className="absolute inset-0 bg-hero-grid bg-grid opacity-60" />
        <div className="absolute right-[-12%] top-[110px] h-[420px] w-[420px] rounded-full bg-orange/10 blur-3xl" />
        <div className="absolute left-[-10%] bottom-[-20%] h-[520px] w-[520px] rounded-full bg-navy/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <div className="mb-4 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[2.6px] text-orange before:h-0.5 before:w-6 before:bg-orange before:content-['']">
              {page.kicker}
            </div>
            <h1 className="font-montserrat text-[clamp(2.35rem,5vw,4.8rem)] font-extrabold italic leading-[0.98] text-navy">
              {page.h1}
            </h1>
            <p className="mt-6 max-w-[680px] text-[16px] leading-[1.85] text-muted">
              {page.intro}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/booking/vehicles"
                className="inline-flex items-center gap-2 rounded-full bg-orange px-7 py-3.5 font-syne text-[14px] font-bold text-white shadow-orange-glow transition-all hover:bg-orange-dark hover:scale-[1.02]"
              >
                Search rental cars <Search size={16} />
              </a>
              <a
                href="/fleet"
                className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white px-7 py-3.5 font-syne text-[14px] font-bold text-navy transition-all hover:border-orange hover:text-orange"
              >
                View vehicle fleet <ArrowRight size={16} />
              </a>
            </div>
          </div>

          <div className="rounded-[30px] bg-navy p-5 text-white shadow-card">
            <div className="rounded-[24px] border border-white/10 bg-white/8 p-6">
              <ShieldCheck className="mb-5 text-orange" size={34} />
              <h2 className="font-syne text-[1.6rem] font-extrabold">Why book with YITU?</h2>
              <div className="mt-5 grid gap-3">
                {page.highlights.map((highlight) => (
                  <div key={highlight} className="flex gap-3 rounded-card bg-white/8 p-3 text-[13.5px] leading-[1.55] text-white/82">
                    <CheckCircle2 className="mt-0.5 shrink-0 text-orange" size={17} />
                    {highlight}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-18 sm:px-10">
        <div className="mx-auto grid max-w-[1100px] gap-8 lg:grid-cols-3">
          <div className="rounded-[24px] border border-black/10 bg-off-white p-6">
            <MapPin className="mb-4 text-orange" size={28} />
            <h2 className="font-syne text-[1.3rem] font-extrabold text-navy">{page.locationName}</h2>
            <p className="mt-3 text-[14px] leading-[1.75] text-muted">{page.locationCopy}</p>
          </div>

          <div className="rounded-[24px] border border-black/10 bg-off-white p-6">
            <Route className="mb-4 text-orange" size={28} />
            <h2 className="font-syne text-[1.3rem] font-extrabold text-navy">Popular self-drive routes</h2>
            <ul className="mt-3 space-y-2.5 text-[14px] leading-[1.7] text-muted">
              {page.routeIdeas.map((route) => (
                <li key={route} className="flex gap-2">
                  <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
                  {route}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[24px] border border-black/10 bg-off-white p-6">
            <Search className="mb-4 text-orange" size={28} />
            <h2 className="font-syne text-[1.3rem] font-extrabold text-navy">Rental cars, SUVs and vans</h2>
            <p className="mt-3 text-[14px] leading-[1.75] text-muted">{page.fleetCopy}</p>
          </div>
        </div>
      </section>

      <section className="bg-navy px-5 py-18 text-white sm:px-10">
        <div className="mx-auto max-w-[950px]">
          <p className="text-center text-[11px] font-bold uppercase tracking-[2.6px] text-orange">Rental FAQ</p>
          <h2 className="mt-3 text-center font-montserrat text-[clamp(1.9rem,3vw,2.8rem)] font-extrabold italic">
            Questions about {page.title}
          </h2>
          <div className="mt-8 grid gap-3">
            {page.faqs.map((faq) => (
              <details key={faq.question} className="rounded-card bg-white/8 p-5 open:bg-white/12">
                <summary className="cursor-pointer list-none font-syne text-[15px] font-bold">
                  {faq.question}
                </summary>
                <p className="mt-3 text-[14px] leading-[1.75] text-white/72">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </HomeClient>
  )
}
