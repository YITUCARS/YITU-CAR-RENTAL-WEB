import type { Metadata, Viewport } from 'next'
import './globals.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import { Syne, DM_Sans, Montserrat } from 'next/font/google'
import ChatWidget from '@/components/ChatWidget'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '600', '700', '800'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600'],
})

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['600','700', '800', '900'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'YITU Car Rental — New Zealand',
  description:
      'New Zealand\'s trusted car rental since 2011. Unlimited KM, clean modern fleet, four locations nationwide. Auckland, Christchurch, Queenstown, Wellington.',
  keywords: 'car rental New Zealand, Auckland car hire, Christchurch rental, NZ road trip',
  icons: {
    icon: '/YITU LOGO.PNG',
  },
  openGraph: {
    title: 'YITU Car Rental — New Zealand',
    description: 'Trusted NZ car rental since 2011. Unlimited KM. 4 locations.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
      <html lang="en">
      <head>
        <meta name="google-site-verification" content="6jSbpSDcCqS3noZzwqtphT5k5Gae8v6Unzy9pl6b0b0" />
      </head>
      <body className={`${syne.variable} ${dmSans.variable} ${montserrat.variable}`}>
      {children}
      <ChatWidget />
      </body>
      </html>
  )
}
