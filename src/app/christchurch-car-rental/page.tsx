import type {Metadata} from 'next'
import CarRentalLandingPage from '@/components/seo/CarRentalLandingPage'
import {seoLandingPages} from '@/lib/seo-landing-pages'

const page = seoLandingPages.christchurch

export const metadata: Metadata = {
  title: {absolute: page.metaTitle},
  description: page.description,
  alternates: {
    canonical: `https://www.yiturentalcars.co.nz/en/${page.slug}`,
    languages: {
      'en-NZ': `https://www.yiturentalcars.co.nz/en/${page.slug}`,
      'zh-Hans': `https://www.yiturentalcars.co.nz/zh/${page.slug}`,
    },
  },
  openGraph: {
    title: page.metaTitle,
    description: page.description,
    url: `https://www.yiturentalcars.co.nz/en/${page.slug}`,
    type: 'website',
  },
}

export default function ChristchurchCarRentalPage() {
  return <CarRentalLandingPage page={page} />
}
