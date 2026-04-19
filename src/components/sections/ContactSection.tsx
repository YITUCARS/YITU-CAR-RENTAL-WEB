import Image from 'next/image'
import { Phone, Mail, Bell, Headphones, CalendarCheck, MapPin } from 'lucide-react'

const WECHAT_ID = 'YituPrestigeCar'

const FEATURES = [
  { icon: Bell, label: 'Real-time booking notifications' },
  { icon: Headphones, label: 'Bilingual support (EN & ZH)' },
  { icon: CalendarCheck, label: 'Instant reservation confirmation' },
  { icon: MapPin, label: 'Airport pick-up available' },
]

const CONTACT_BTNS = [
  {
    icon: Phone,
    small: 'Call us',
    strong: '0800 948 888',
    iconColor: 'text-navy',
  },
  {
    icon: Mail,
    small: 'Email',
    strong: 'booking@yiturentalcars.co.nz',
    iconColor: 'text-navy',
  },
  {
    icon: null,
    wechat: true,
    small: 'WeChat',
    strong: '微信预订',
    iconColor: 'text-[#07c160]',
  },
]

export default function ContactSection() {
  return (
    <section id="contact" className="py-20 px-10 border-t border-black/10">
      <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-[60px] items-center">

        {/* Left text */}
        <div>
          <div className="flex items-center gap-2 text-[11.5px] text-orange uppercase tracking-[2.5px] font-bold mb-2.5 before:content-[''] before:w-5 before:h-0.5 before:bg-orange">
            Stay Connected
          </div>
          <h2 className="font-montserrat font-extrabold italic text-[clamp(1.8rem,3vw,2.6rem)] text-navy leading-[1.15] mb-4">
            Book From <span className="text-orange">Anywhere</span>
          </h2>
          <p className="text-muted text-[14.5px] leading-[1.75] mb-7">
            Chinese-speaking customers can book directly via WeChat — our team will confirm your reservation within one business day.
          </p>

          {/* Feature list */}
          <div className="flex flex-col gap-3.5 mb-8">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-[14px] text-muted">
                <span className="w-7 h-7 bg-orange/12 rounded-[6px] flex items-center justify-center flex-shrink-0">
                  <Icon size={12} className="text-orange" />
                </span>
                {label}
              </div>
            ))}
          </div>

          {/* Contact buttons */}
          <div className="flex flex-wrap gap-3">
            {CONTACT_BTNS.map((btn) => (
              <div
                key={btn.strong}
                className="flex items-center gap-2.5 bg-white border-[1.5px] border-black/10 rounded-[10px] px-[18px] py-2.5"
              >
                {btn.wechat ? (
                  <span className="text-[20px] leading-none">💬</span>
                ) : btn.icon ? (
                  <btn.icon size={20} className={btn.iconColor} />
                ) : null}
                <div>
                  <small className="block text-[10px] text-muted uppercase tracking-[0.5px]">{btn.small}</small>
                  <strong className="block font-syne text-[14px] text-navy">{btn.strong}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — phone mockup */}
        <div className="hidden lg:flex justify-center relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full bg-orange/10 blur-[60px] pointer-events-none" />
          <div className="relative z-10 w-[252px] bg-white border border-black/10 rounded-[34px] overflow-hidden shadow-[0_26px_60px_rgba(15,23,42,0.18)]">
            {/* Notch */}
            <div className="w-[72px] h-[22px] bg-off-white rounded-b-[14px] mx-auto mb-2.5" />
            {/* Screen */}
            <div className="px-2.5 pb-2.5">
              <div className="text-[10px] text-muted mb-2 px-1">YITU Car Rental</div>

              {/* WeChat QR card */}
              <div className="bg-off-white rounded-[14px] p-3 mb-2">
                <div className="rounded-[12px] bg-white p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <Image
                    src="/f41e600cbd0ea4695121c50896f17aab.JPG"
                    alt="YITU WeChat QR code"
                    width={300}
                    height={300}
                    className="w-full h-[132px] object-contain rounded-[10px]"
                  />
                </div>
                <div className="font-syne font-bold text-[11px] text-navy mt-2.5">Scan To Chat On WeChat</div>
                <div className="text-[10px] text-muted mt-0.5">Fast support for bookings, payments, and travel questions.</div>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="font-syne font-extrabold text-[13px] text-[#07c160]">WeChat</span>
                  <div className="bg-[#07c160] text-white text-[10px] font-syne font-bold px-3 py-1.5 rounded-[6px]">
                    Add Now
                  </div>
                </div>
              </div>

              {/* WeChat details */}
              <div className="bg-off-white rounded-[10px] p-3">
                <div className="text-[10px] text-navy font-bold mb-1.5">WeChat Contact</div>
                <div className="rounded-[8px] bg-white px-2.5 py-2 mb-2">
                  <div className="text-[8px] text-muted uppercase tracking-[0.18em] mb-0.5">WeChat ID</div>
                  <div className="font-syne font-bold text-[11px] text-navy break-all">{WECHAT_ID}</div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    ['💬', 'Chinese Support'],
                    ['⚡', 'Quick Reply'],
                    ['📅', 'Booking Help'],
                    ['💳', 'Payment Support'],
                  ].map(([emoji, label]) => (
                    <div key={label} className="text-[9.5px] text-muted flex items-center gap-1">
                      <span>{emoji}</span>{label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
