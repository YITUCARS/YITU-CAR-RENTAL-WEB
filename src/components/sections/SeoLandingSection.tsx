import {ArrowRight, CheckCircle2, MapPin, ShieldCheck} from 'lucide-react'

const locationLinks = [
  {
    label: 'Christchurch car rental',
    href: '#locations',
    copy: 'Pick up from Hornby, close to Christchurch Airport and the South Island touring routes.',
  },
  {
    label: 'Queenstown car rental',
    href: '#locations',
    copy: 'Start your alpine road trip from Frankton, near Queenstown Airport and Lake Wakatipu.',
  },
]

const faqs = [
  {
    question: 'What is included with YITU car rental in New Zealand?',
    answer:
      'YITU rentals include unlimited kilometres, a clean and well-maintained vehicle, standard insurance cover, and friendly support from booking to return.',
  },
  {
    question: 'Can I book a one-way car rental in New Zealand?',
    answer:
      'Selected one-way rentals are available between Christchurch and Queenstown, making South Island road trips easier to plan.',
  },
  {
    question: 'Which New Zealand car rental locations does YITU serve?',
    answer:
      'YITU currently serves Christchurch and Queenstown, with pick-up and drop-off options designed for South Island travellers.',
  },
]

export const homeSeoJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CarRental',
      '@id': 'https://www.yiturentalcars.co.nz/#business',
      name: 'YITU Car Rental',
      url: 'https://www.yiturentalcars.co.nz/',
      logo: 'https://www.yiturentalcars.co.nz/YITU_CAR_RENTAL_Logo.png',
      image: 'https://www.yiturentalcars.co.nz/vehicles-bg.jpg',
      sameAs: ['https://www.instagram.com/yitu_car_rental/'],
      telephone: '+64 3 3410109',
      email: 'Yitucars@hotmail.com',
      priceRange: '$$',
      areaServed: ['New Zealand', 'Christchurch', 'Queenstown', 'South Island'],
      slogan: 'Reliable, comfortable and affordable car rental in New Zealand',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '222 Main South Road, Hornby',
        addressLocality: 'Christchurch',
        postalCode: '8042',
        addressCountry: 'NZ',
      },
      openingHoursSpecification: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '08:30',
        closes: '17:30',
      },
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.yiturentalcars.co.nz/#website',
      url: 'https://www.yiturentalcars.co.nz/',
      name: 'YITU Car Rental',
      inLanguage: 'en-NZ',
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://www.yiturentalcars.co.nz/#car-rental-faq',
      mainEntity: faqs.map((faq) => ({
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

export default function SeoLandingSection() {
  return (
    <section className="relative overflow-hidden bg-white px-5 py-20 sm:px-10">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent" />

      <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[2.5px] text-orange before:h-0.5 before:w-5 before:bg-orange before:content-['']">
            New Zealand Car Rental Guide
          </div>
          <h2 className="font-montserrat text-[clamp(1.9rem,3.2vw,3rem)] font-extrabold italic leading-[1.08] text-navy">
            Car Rental in New Zealand for South Island Road Trips
          </h2>
          <p className="mt-4 max-w-[640px] text-[15px] leading-[1.85] text-muted">
            YITU Car Rental helps travellers book reliable car hire in New Zealand with unlimited kilometres,
            transparent pricing, bilingual support and flexible pick-up options in Christchurch and Queenstown.
            Whether you need a compact car, SUV, people mover or premium vehicle, our fleet is prepared for scenic
            highways, family holidays and business travel across the South Island.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              'Unlimited kilometres for NZ road trips',
              'Christchurch and Queenstown locations',
              'SUV, van and family car hire options',
            ].map((item) => (
              <div
                key={item}
                className="rounded-card border border-black/10 bg-off-white px-4 py-4 text-[13px] font-semibold leading-[1.45] text-navy"
              >
                <CheckCircle2 className="mb-2 text-orange" size={18} />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[26px] border border-black/10 bg-off-white p-5 shadow-card">
          <div className="rounded-[20px] bg-navy p-6 text-white">
            <ShieldCheck className="mb-4 text-orange" size={30} />
            <h3 className="font-syne text-[1.35rem] font-extrabold">Why travellers choose YITU</h3>
            <p className="mt-3 text-[13.5px] leading-[1.7] text-white/75">
              A local New Zealand rental team, responsive support, clear booking terms and vehicles maintained for
              long-distance self-drive holidays.
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            {locationLinks.map((location) => (
              <a
                key={location.label}
                href={location.href}
                className="group rounded-card bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-card"
              >
                <span className="flex items-center gap-2 font-syne text-[15px] font-bold text-navy">
                  <MapPin size={16} className="text-orange" /> {location.label}
                </span>
                <span className="mt-1 block text-[12.8px] leading-[1.6] text-muted">{location.copy}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-[1100px] rounded-[26px] bg-navy px-6 py-7 text-white sm:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[2.5px] text-orange">Car hire FAQ</p>
            <h3 className="mt-2 font-syne text-[1.6rem] font-extrabold">New Zealand rental questions</h3>
          </div>

          <div className="grid gap-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-card bg-white/8 p-4 open:bg-white/12">
                <summary className="cursor-pointer list-none font-syne text-[14.5px] font-bold text-white">
                  {faq.question}
                </summary>
                <p className="mt-2 text-[13.5px] leading-[1.7] text-white/72">{faq.answer}</p>
              </details>
            ))}

            <a
              href="#booking"
              className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-orange px-5 py-3 font-syne text-[13px] font-bold text-white transition-colors hover:bg-orange-dark"
            >
              Search New Zealand car rental rates <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
