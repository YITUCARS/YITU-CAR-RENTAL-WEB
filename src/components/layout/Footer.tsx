import Image from 'next/image'
import Link from 'next/link'
import { Phone, Mail, Clock, CalendarCheck } from 'lucide-react'
import { NAV_LINKS } from '@/lib/data'
import XiaohongshuRednoteIcon from '@/components/ui/XiaohongshuRednoteIcon'

interface FooterProps {
  onManageBooking: () => void
}

export default function Footer({ onManageBooking }: FooterProps) {
  return (
    <footer className="bg-white border-t border-black/10 pt-[60px]">
      <div className="max-w-[1100px] mx-auto px-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr] gap-14 pb-12 border-b border-black/10">
          {/* Brand column */}
          <div>
            <Image
              src="/YITU CAR RENTAL logo.svg"
              alt="YITU Car Rental"
              width={160}
              height={32}
              className="h-8 w-auto mb-4"
            />
            <p className="text-muted text-[13.5px] leading-[1.75] max-w-[260px] mb-[22px]">
              New Zealand&apos;s trusted car rental since 2011. Unlimited KM, clean modern fleet, four locations nationwide.
            </p>
            <div className="flex gap-2.5">
              {[
                { icon: 'fab fa-instagram', href: '#' },
                { icon: 'fab fa-tiktok', href: '#' },
                { icon: 'custom-xiaohongshu', href: 'https://xhslink.com/m/8Tm4GeTZ88i' },
                { icon: 'fab fa-facebook-f', href: '#' },
              ].map((s) => (
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

          {/* Quick Links */}
          <div>
            <h4 className="font-syne font-bold text-[13px] text-navy mb-[18px] uppercase tracking-[0.9px]">
              Quick Links
            </h4>
            <ul className="space-y-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-[13.5px] text-muted transition-colors hover:text-orange"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-syne font-bold text-[13px] text-navy mb-[18px] uppercase tracking-[0.9px]">
              Contact
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
                +64 27 3922 666
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
                <span>Mon - Sun 8.30 - 17.30</span>
              </div>
            </div>
            <div className="mt-[18px]">
              <button
                onClick={onManageBooking}
                className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white font-syne font-bold text-[12.5px] px-[18px] py-2.5 rounded-lg transition-colors"
              >
                <CalendarCheck size={13} />
                Manage Booking
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-wrap justify-between items-center gap-2.5 py-[18px] text-[12px] text-muted/70">
          <span>© 2026 YITU Car Rental. All rights reserved.</span>
          <div>
            <Link href="/terms-conditions" className="text-muted/70 ml-3.5 hover:text-orange transition-colors">
              Terms &amp; Conditions
            </Link>
            <Link href="/privacy-policy" className="text-muted/70 ml-3.5 hover:text-orange transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
