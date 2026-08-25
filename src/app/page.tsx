import { createClient } from '@supabase/supabase-js'
import HomeClient from './HomeClient'
import HeroSection from '@/components/sections/HeroSection'
import BookingSection from '@/components/sections/BookingSection'
import StatsStrip from '@/components/sections/StatsStrip'
import FleetSection from '@/components/sections/FleetSection'
import DealsSection from '@/components/sections/DealsSection'
import LocationsSection from '@/components/sections/LocationsSection'
import ContactSection from '@/components/sections/ContactSection'
import CTASplitSection from '@/components/sections/CTASplitSection'
import ReviewsSection from '@/components/sections/ReviewsSection'
import SeoLandingSection, {homeSeoJsonLd} from '@/components/sections/SeoLandingSection'
import TriAiCarFinderSection from '@/components/sections/TriAiCarFinderSection'
import type {Metadata} from 'next'

// Always fetch fresh data from Supabase on every request
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    absolute: 'New Zealand Car Rental & Car Hire | YITU Car Rental',
  },
  description:
    'Book reliable car rental in New Zealand with YITU. Unlimited kilometres, clean modern cars, SUVs and vans, plus Christchurch and Queenstown pick-up locations.',
  alternates: {
    canonical: 'https://www.yiturentalcars.co.nz/',
    languages: {
      'en-NZ': 'https://www.yiturentalcars.co.nz/en',
      'zh-Hans': 'https://www.yiturentalcars.co.nz/zh',
    },
  },
  openGraph: {
    title: 'New Zealand Car Rental & Car Hire | YITU Car Rental',
    description:
      'Reliable New Zealand car hire with unlimited kilometres, Christchurch and Queenstown locations, SUVs, vans and bilingual support.',
    url: 'https://www.yiturentalcars.co.nz/',
    siteName: 'YITU Car Rental',
    type: 'website',
    images: [
      {
        url: 'https://www.yiturentalcars.co.nz/vehicles-bg.jpg',
        width: 2575,
        height: 1437,
        alt: 'YITU Car Rental New Zealand vehicle handover',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'New Zealand Car Rental & Car Hire | YITU Car Rental',
    description:
      'Book reliable car rental in New Zealand with unlimited kilometres and Christchurch or Queenstown pick-up.',
    images: ['https://www.yiturentalcars.co.nz/vehicles-bg.jpg'],
  },
}

async function getFeaturedVehicles() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await supabase
      .from('rcm_featured')
      .select('slot, vehicle_json')
      .order('slot')
    if (error) console.error('[page] getFeaturedVehicles error:', error.message)
    return (data ?? []).map((r: any) => ({ slot: r.slot, ...r.vehicle_json }))
  } catch (err: any) {
    console.error('[page] getFeaturedVehicles failed:', err.message)
    return []
  }
}

async function getDeals() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await supabase
      .from('deals')
      .select('id, slug, title, description, value, unit, badge, image_url, content')
      .eq('active', true)
      .order('display_order')
    if (error) console.error('[page] getDeals error:', error.message)
    return data ?? []
  } catch (err: any) {
    console.error('[page] getDeals failed:', err.message)
    return []
  }
}

export default async function HomePage() {
  const [deals, featuredVehicles] = await Promise.all([getDeals(), getFeaturedVehicles()])

  return (
    <HomeClient>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: JSON.stringify(homeSeoJsonLd)}}
      />
      <HeroSection initialDeals={deals} />
      <BookingSection />
      <div className="reveal">
        <TriAiCarFinderSection />
      </div>
      <StatsStrip />
      <div className="reveal">
        <FleetSection initialVehicles={featuredVehicles} />
      </div>
      <div className="reveal">
        <DealsSection initialDeals={deals} />
      </div>
      <div className="reveal">
        <ReviewsSection />
      </div>
      <div className="reveal">
        <SeoLandingSection />
      </div>
      <div className="reveal">
        <LocationsSection />
      </div>
      <div className="reveal">
        <ContactSection />
      </div>
      <div className="reveal">
        <CTASplitSection />
      </div>
    </HomeClient>
  )
}
