'use client'

import Image from 'next/image'
import {Phone, Mail, Clock, CalendarCheck} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {NAV_LINKS} from '@/lib/data'
import {Link} from '@/i18n/navigation'
import XiaohongshuRednoteIcon from '@/components/ui/XiaohongshuRednoteIcon'

interface FooterProps {
  onManageBooking: () => void
}

export default function Footer({onManageBooking}: FooterProps) {
  const t = useTranslations()

  const resolveHref = (href: string) => {
    if (href.startsWith('#')) return `/${href}`
    return href
  }

  return (
    <footer className="bg-white border-t border-black/10 pt-[60px]">
      <div className="max-w-[1100px] mx-auto px-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr] gap-14 pb-12 border-b border-black/10">
          <div>
            <Image
              src="/YITU CAR RENTAL logo.svg"
              alt="YITU Car Rental"
              width={180}
              height={36}
              className="h-9 w-auto mb-4"
            />
            <p className="text-muted text-[13.5px] leading-[1.75] max-w-[260px] mb-[22px]">
              {t('Footer.description')}
            </p>
            <div className="flex gap-2.5">
              {[
                {icon: 'fab fa-instagram', href: '#'},
                {icon: 'fab fa-tiktok', href: '#'},
                {icon: 'custom-xiaohongshu', href: 'https://xhslink.com/m/8Tm4GeTZ88i'},
                {icon: 'fab fa-facebook-f', href: '#'},
              ].map(s => (
                <a
                  key={s.icon}
                  href={s.href}
                  className="w-9 h-9 rounded-lg bg-black/5 border border-black/10 flex items-center justify-center text-muted transition-all hover:bg-orange hover:border-orange hover:text-white"
                >
                  {s.icon === 'custom-xiaohongshu' ? (
                    <XiaohongshuRednoteIcon size={14} color="currentColor" strokeWidth={3} />
                  ) : (
                    <i className={`${s.icon} text-xs`} />
                  )}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-syne font-bold text-[13px] text-navy mb-[18px] uppercase tracking-[0.9px]">
              {t('Footer.quickLinks')}
            </h4>
            <ul className="space-y-2.5">
              {NAV_LINKS.map(link => (
                <li key={link.href}>
                  <Link
                    href={resolveHref(link.href)}
                    className="text-[13.5px] text-muted transition-colors hover:text-orange"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-syne font-bold text-[13px] text-navy mb-[18px] uppercase tracking-[0.9px]">
              {t('Footer.contact')}
            </h4>
            <div className="space-y-[11px]">
              <div className="flex items-center gap-2.5 text-[13.5px] text-muted">
                <Phone size={12} className="text-orange flex-shrink-0" />
                <a href="tel:+64273922666" className="hover:text-orange transition-colors">
                  0800 948 888
                </a>
              </div>
              <div className="flex items-center gap-2.5 text-[13.5px] text-muted">
                <Phone size={12} className="text-orange flex-shrink-0" />
                <a href="tel:0800948888" className="hover:text-orange transition-colors">
                  +64 27 3922 666/+64 21 873 789
                </a>
              </div>
              <div className="flex items-center gap-2.5 text-[13.5px] text-muted">
                <Mail size={12} className="text-orange flex-shrink-0" />
                <a href="mailto:booking@yiturentalcars.co.nz" className="hover:text-orange transition-colors">
                  booking@yiturentalcars.co.nz
                </a>
              </div>
              <div className="flex items-center gap-2.5 text-[13.5px] text-muted">
                <Clock size={12} className="text-orange flex-shrink-0" />
                <span>{t('Footer.hours')}</span>
              </div>
            </div>
            <div className="mt-[18px]">
              <button
                onClick={onManageBooking}
                className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[12.5px] px-[18px] py-2.5 rounded-lg transition-colors"
              >
                <CalendarCheck size={13} />
                {t('Footer.manageBooking')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-2.5 py-[18px] text-[12px] text-muted/70">
          <span>{t('Footer.copyright')}</span>
          <div>
            <Link href="/terms-conditions" className="text-muted/70 ml-3.5 hover:text-orange transition-colors">
              {t('Navigation.terms')}
            </Link>
            <Link href="/privacy-policy" className="text-muted/70 ml-3.5 hover:text-orange transition-colors">
              {t('Navigation.privacy')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
