'use client'

import {useEffect, useState} from 'react'
import {usePathname as useRawPathname} from 'next/navigation'
import Image from 'next/image'
import {X, CalendarCheck, Search, ChevronDown} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import {NAV_LINKS} from '@/lib/data'
import {Link, usePathname, useRouter} from '@/i18n/navigation'
import {cn} from '@/lib/utils'

interface NavbarProps {
  onManageBooking: () => void
  /** Float the header over a full-bleed hero: transparent while the hero is in view, inverted to a light bar once past it. */
  overlay?: boolean
}

const ABOUT_LINKS = [
  {href: '/about', labelKey: 'Navigation.aboutUs'},
  {href: '/terms-conditions', labelKey: 'Navigation.terms'},
  {href: '/privacy-policy', labelKey: 'Navigation.privacy'},
  {href: '/wear-and-tear', labelKey: 'Navigation.wearAndTear'},
]

// Contact strip (32px) + nav height, i.e. where the header stops covering the hero.
const NAV_BOTTOM = 102

const LINKS_BEFORE_ABOUT = NAV_LINKS.slice(0, 2)
const LINKS_AFTER_ABOUT = NAV_LINKS.slice(2)

export default function Navbar({onManageBooking, overlay = false}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileAboutOpen, setMobileAboutOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [pastHero, setPastHero] = useState(false)
  const pathname = usePathname()
  const rawPathname = useRawPathname()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    if (!overlay) return
    const handler = () => {
      const anchor = document.querySelector('[data-nav-overlay-anchor]')
      const heroBottom = anchor ? anchor.getBoundingClientRect().bottom : window.innerHeight
      setPastHero(heroBottom <= NAV_BOTTOM)
    }
    handler()
    window.addEventListener('scroll', handler, {passive: true})
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
    }
  }, [overlay])

  // Transparent over the hero image, light bar with dark text below it.
  const onHero = overlay && !pastHero
  const lightBar = overlay && pastHero

  // Keeps white type readable where the hero image goes bright, without tinting the picture.
  const heroShadow = onHero ? '[text-shadow:0_1px_12px_rgba(0,0,0,0.55)]' : ''

  const navLinkClass = cn(
    'text-[13.5px] font-medium px-[15px] py-2 rounded-lg transition-all',
    lightBar ? 'text-navy/75 hover:text-navy hover:bg-navy/[0.06]' : 'text-white/78 hover:text-white hover:bg-white/10',
    onHero && 'text-white/90',
    heroShadow
  )

  const isHomePage = pathname === '/'

  const resolveNavHref = (href: string) => {
    if (href.startsWith('#')) return isHomePage ? href : `/${href}`
    return href
  }

  const goToBooking = () => {
    router.push('/booking/vehicles')
    setMobileOpen(false)
  }

  const switchLocale = (nextLocale: 'en' | 'zh') => {
    const query = typeof window !== 'undefined' ? window.location.search : ''
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const pathWithoutLocale = rawPathname.replace(/^\/(en|zh)(?=\/|$)/, '') || '/'
    const nextPath = `/${nextLocale}${pathWithoutLocale === '/' ? '' : pathWithoutLocale}${query}`

    if (typeof window !== 'undefined') {
      window.location.href = `${nextPath}${hash}`
      return
    }

    router.push(nextPath)
    setMobileOpen(false)
  }

  const localeToggleLabel = locale === 'en' ? t('LocaleSwitcher.zh') : t('LocaleSwitcher.en')

  return (
    <>
      {onHero && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[190px] bg-[linear-gradient(180deg,rgba(0,0,0,0.66)_0%,rgba(0,0,0,0.34)_50%,rgba(0,0,0,0)_100%)]"
        />
      )}

      <div className={cn(
        'fixed top-0 left-0 right-0 z-[60] h-8 flex items-center justify-center gap-2 sm:gap-8 px-4 sm:px-10 transition-colors duration-300',
        onHero ? 'bg-transparent' : 'bg-navy'
      )}>
        <a
          href="tel:+6421234567"
          className={cn('flex items-center gap-1.5 text-white/70 hover:text-white text-[12px] font-medium transition-colors', onHero && 'text-white/90', heroShadow)}
        >
          📞 +64 800 948 888
        </a>

        <span className="hidden sm:inline text-white/20 text-[10px]">|</span>

        <a
          href="mailto:info@yitucarrental.co.nz"
          className={cn('hidden sm:flex items-center gap-1.5 text-white/70 hover:text-white text-[12px] font-medium transition-colors', onHero && 'text-white/90', heroShadow)}
        >
          ✉️ booking@yiturentalcars.co.nz
        </a>

        <span className="hidden sm:inline text-white/20 text-[10px]">|</span>

        <a
          href="mailto:info@yitucarrental.co.nz"
          className={cn('hidden sm:flex items-center gap-1.5 text-white/70 hover:text-white text-[12px] font-medium transition-colors', onHero && 'text-white/90', heroShadow)}
        >
          ⏰ {t('Navbar.hours')}
        </a>
      </div>

      <nav
        className={cn(
          'fixed top-8 left-0 right-0 z-50 flex items-center justify-between px-10 py-3.5 transition-all duration-300',
          onHero
            ? 'bg-transparent border-b border-transparent'
            : lightBar
              ? 'bg-white/95 backdrop-blur-lg border-b border-black/[0.07]'
              : 'bg-navy/94 backdrop-blur-lg border-b border-white/[0.09]',
          scrolled && !onHero && 'shadow-lg'
        )}
      >
        <Link href="/" className="flex items-center">
          <Image
            src="/YITU CAR RENTAL logo.svg"
            alt="YITU Car Rental"
            width={200}
            height={40}
            className={cn('h-10 w-auto transition-[filter] duration-300', onHero ? 'brightness-0 invert' : !lightBar && 'brightness-110')}
            priority
          />
        </Link>

        <div className="hidden lg:flex items-center gap-0.5">
          {LINKS_BEFORE_ABOUT.map(link => (
            <Link
              key={link.href}
              href={resolveNavHref(link.href)}
              className={navLinkClass}
            >
              {t(link.labelKey)}
            </Link>
          ))}

          <div className="relative group">
            <button className={cn('flex items-center gap-1 cursor-pointer', navLinkClass)}>
              {t('Navigation.aboutUs')}
              <ChevronDown
                size={13}
                className="mt-px transition-transform duration-200 group-hover:rotate-180"
              />
            </button>

            <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-1 group-hover:translate-y-0 z-50">
              <div className="bg-navy border border-white/10 rounded-xl overflow-hidden shadow-xl min-w-[190px]">
                {ABOUT_LINKS.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-4 py-2.5 text-[13px] text-white/70 hover:text-white hover:bg-white/10 transition-colors border-b border-white/[0.06] last:border-0"
                  >
                    {t(link.labelKey)}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {LINKS_AFTER_ABOUT.map(link => (
            <Link
              key={link.href}
              href={resolveNavHref(link.href)}
              className={navLinkClass}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <button
            onClick={() => switchLocale(locale === 'en' ? 'zh' : 'en')}
            className={cn(
              'rounded-full border px-[18px] py-2.5 text-[12.5px] font-bold transition-all',
              lightBar
                ? 'border-navy/15 text-navy/75 hover:border-navy/30 hover:bg-navy/[0.06] hover:text-navy'
                : 'border-white/15 text-white/82 hover:border-white/30 hover:bg-white/10 hover:text-white',
              onHero && 'border-white/30 text-white/95 bg-white/10 backdrop-blur-sm',
              heroShadow
            )}
          >
            {localeToggleLabel}
          </button>
          <button
            onClick={onManageBooking}
            className={cn(
              'flex items-center gap-1.5 backdrop-blur-sm border text-navy px-[18px] py-2.5 rounded-full font-syne font-bold text-[12.5px] transition-all',
              lightBar
                ? 'bg-white border-black/10 shadow-sm hover:border-navy/40'
                : 'bg-white/90 border-white/60 hover:bg-white hover:border-white'
            )}
          >
            <CalendarCheck size={13} />
            {t('Navbar.myBooking')}
          </button>
          <button
            onClick={goToBooking}
            className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[13px] px-[22px] py-2.5 rounded-full transition-all hover:scale-[1.04] shadow-orange-glow"
          >
            <Search size={13} />
            {t('Navbar.bookNow')}
          </button>
        </div>

        <button
          className="lg:hidden flex flex-col gap-[5px] p-1"
          onClick={() => setMobileOpen(true)}
          aria-label={t('Navbar.openMenu')}
        >
          <span className={cn('block w-6 h-0.5 rounded transition-colors', lightBar ? 'bg-navy' : 'bg-white')} />
          <span className={cn('block w-6 h-0.5 rounded transition-colors', lightBar ? 'bg-navy' : 'bg-white')} />
          <span className={cn('block w-6 h-0.5 rounded transition-colors', lightBar ? 'bg-navy' : 'bg-white')} />
        </button>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/80" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-[280px] bg-white flex flex-col border-l border-black/10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-[18px] border-b border-black/10">
              <Image
                src="/YITU CAR RENTAL logo.svg"
                alt="YITU"
                width={140}
                height={32}
                className="h-8 w-auto"
              />
              <button
                onClick={() => setMobileOpen(false)}
                className="text-muted text-xl"
                aria-label={t('Common.close')}
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col overflow-y-auto">
              {LINKS_BEFORE_ABOUT.map(link => (
                <Link
                  key={link.href}
                  href={resolveNavHref(link.href)}
                  onClick={() => setMobileOpen(false)}
                  className="block px-5 py-3.5 text-[14.5px] font-semibold text-muted border-b border-black/[0.07] hover:text-orange transition-colors"
                >
                  {t(link.labelKey)}
                </Link>
              ))}

              <button
                onClick={() => setMobileAboutOpen(v => !v)}
                className="flex items-center justify-between px-5 py-3.5 text-[14.5px] font-semibold text-muted border-b border-black/[0.07] hover:text-orange transition-colors w-full text-left"
              >
                {t('Navigation.aboutUs')}
                <ChevronDown
                  size={14}
                  className={cn('transition-transform duration-200', mobileAboutOpen && 'rotate-180')}
                />
              </button>
              {mobileAboutOpen && (
                <div className="bg-off-white border-b border-black/[0.07]">
                  {ABOUT_LINKS.map(link => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-8 py-3 text-[13.5px] font-medium text-muted border-b border-black/[0.05] last:border-0 hover:text-orange transition-colors"
                    >
                      {t(link.labelKey)}
                    </Link>
                  ))}
                </div>
              )}

              {LINKS_AFTER_ABOUT.map(link => (
                <Link
                  key={link.href}
                  href={resolveNavHref(link.href)}
                  onClick={() => setMobileOpen(false)}
                  className="block px-5 py-3.5 text-[14.5px] font-semibold text-muted border-b border-black/[0.07] hover:text-orange transition-colors"
                >
                  {t(link.labelKey)}
                </Link>
              ))}
            </div>

            <div className="mt-auto p-4 flex flex-col gap-2.5 border-t border-black/10">
              <button
                onClick={() => switchLocale(locale === 'en' ? 'zh' : 'en')}
                className="w-full rounded-full border border-black/10 px-4 py-3 text-[13px] font-bold text-navy hover:border-orange hover:text-orange transition-colors"
              >
                {localeToggleLabel}
              </button>
              <button
                onClick={() => { onManageBooking(); setMobileOpen(false) }}
                className="w-full flex items-center justify-center gap-2 bg-off-white border border-black/10 text-navy font-syne font-bold text-sm py-3 rounded-full hover:border-navy transition-colors"
              >
                <CalendarCheck size={14} />
                {t('Navbar.myBooking')}
              </button>
              <button
                onClick={goToBooking}
                className="w-full flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-sm py-3 rounded-full transition-colors"
              >
                <Search size={14} />
                {t('Navbar.bookNow')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
