import Image from 'next/image'

const TRUST_LOGOS = [
  { src: 'https://www.arentalscar.com/media/2025/06/Orange-1-1.png', alt: 'Award' },
  { src: 'https://www.arentalscar.com/media/2025/09/qualmark-endorsement-silver.DcztRw-300x192.jpg', alt: 'Qualmark Silver' },
  { src: 'https://www.arentalscar.com/media/2025/06/1-300x300.png', alt: 'Partner' },
  { src: 'https://www.arentalscar.com/media/2025/06/2-300x300.png', alt: 'Partner' },
  { src: 'https://www.arentalscar.com/media/2025/06/3-300x300.png', alt: 'Partner' },
]

export default function TrustSection() {
  return (
    <section className="py-[60px] px-10 border-t border-black/10">
      <div className="max-w-[1100px] mx-auto text-center">
        <div className="font-syne font-extrabold text-navy mb-3 text-[clamp(2rem,5vw,3.8rem)] leading-tight">
          <span className="text-orange">15+</span> Years Serving<br />
          New Zealand Travellers
        </div>
        <p className="text-muted text-[15px] max-w-[500px] mx-auto mb-9">
          Trusted by thousands of families, groups and international visitors for reliable, premium car rentals across NZ.
        </p>

        <div className="text-[11.5px] text-muted uppercase tracking-[2px] mb-7 font-semibold">
          Recognised &amp; Endorsed
        </div>

        <div className="flex justify-center flex-wrap gap-11 grayscale opacity-40">
          {TRUST_LOGOS.map((logo) => (
            <div key={logo.src} className="relative h-11 w-24">
              <Image
                src={logo.src}
                alt={logo.alt}
                fill
                className="object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
