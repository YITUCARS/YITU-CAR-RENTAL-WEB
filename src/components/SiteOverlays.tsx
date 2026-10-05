'use client'

import { usePathname } from 'next/navigation'
import ChatWidget from '@/components/ChatWidget'
import CookieConsentBanner from '@/components/ui/CookieConsentBanner'

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
