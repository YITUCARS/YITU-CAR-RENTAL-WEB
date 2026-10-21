import type { Metadata } from 'next'
import FleetPage from '../../fleet/page'

export const metadata: Metadata = {
  title: 'Car Rental Fleet in New Zealand | YITU Car Rental',
  description: 'Explore YITU Car Rental vehicles for Christchurch, Queenstown and New Zealand road trips, from compact cars and SUVs to spacious people movers.',
  alternates: { canonical: 'https://www.yiturentalcars.co.nz/en/fleet' },
  robots: { index: true, follow: true },
}

export default FleetPage
