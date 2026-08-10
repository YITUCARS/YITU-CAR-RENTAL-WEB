import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import './globals.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import { Syne, DM_Sans, Montserrat } from 'next/font/google'
import ChatWidget from '@/components/ChatWidget'
import CookieConsentBanner from '@/components/ui/CookieConsentBanner'
import messages from '../../messages/en.json'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  preload: true,
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600'],
  display: 'swap',
  preload: true,
})

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['600', '700', '800', '900'],
  display: 'swap',
  preload: true,
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.yiturentalcars.co.nz'),
  title: {
    default: 'New Zealand Car Rental & Car Hire | YITU Car Rental',
    template: '%s | YITU Car Rental',
  },
  description:
      'Book reliable car rental in New Zealand with YITU. Unlimited kilometres, clean modern fleet, Christchurch and Queenstown pick-up locations.',
  keywords: [
    'new zealand car rental',
    'car rental New Zealand',
    'car hire New Zealand',
    'Christchurch car rental',
    'Queenstown car rental',
    'South Island car hire',
    'NZ road trip rental car',
  ],
  alternates: {
    canonical: '/',
    languages: {
      'en-NZ': '/en',
      'zh-Hans': '/zh',
    },
  },
  icons: {
    icon: '/YITU LOGO.PNG',
  },
  openGraph: {
    title: 'New Zealand Car Rental & Car Hire | YITU Car Rental',
    description: 'Trusted NZ car rental since 2011. Unlimited kilometres. Christchurch and Queenstown locations.',
    url: 'https://www.yiturentalcars.co.nz/',
    siteName: 'YITU Car Rental',
    type: 'website',
    locale: 'en_NZ',
    images: [
      {
        url: '/vehicles-bg.jpg',
        width: 2575,
        height: 1437,
        alt: 'YITU Car Rental New Zealand',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'New Zealand Car Rental & Car Hire | YITU Car Rental',
    description: 'Reliable New Zealand car rental with unlimited kilometres and South Island locations.',
    images: ['/vehicles-bg.jpg'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
      <html lang="en">
      <head>
        <meta name="google-site-verification" content="6jSbpSDcCqS3noZzwqtphT5k5Gae8v6Unzy9pl6b0b0" />
      </head>
      <body className={`${syne.variable} ${dmSans.variable} ${montserrat.variable}`}>
        <NextIntlClientProvider locale="en" messages={messages}>
          {children}
          <ChatWidget />
          <CookieConsentBanner />
        </NextIntlClientProvider>
      </body>
      </html>
  )
}
