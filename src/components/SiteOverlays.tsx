'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import CookieConsentBanner from '@/components/ui/CookieConsentBanner'

// Loaded on demand so the /h5 pages never pull in the chat's Firebase and
// Stripe code, whose frames the mini program's web-view refuses to show.
const ChatWidget = dynamic(() => import('@/components/ChatWidget'), { ssr: false })

// Site-wide floating chat and cookie notice. The /h5 pages are opened inside
// WeChat (often in the mini program's web-view), where these would cover the
// small screen, so they are left out there.
export default function SiteOverlays() {
    const pathname = usePathname() || '/'
    if (pathname.startsWith('/h5')) return null
    return <>
        <ChatWidget />
        <CookieConsentBanner />
    </>
}
