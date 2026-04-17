'use client'

import { useEffect, useState } from 'react'
import { Camera, Expand } from 'lucide-react'

interface GalleryImage {
  name: string
  path: string
  url: string
  created_at?: string | null
}

export default function GallerySection() {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)

  useEffect(() => {
    fetch('/api/public/gallery')
      .then(r => r.json())
      .then(data => setImages(Array.isArray(data) ? data : []))
      .catch(() => setImages([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section id="gallery" className="py-20 px-10 bg-[linear-gradient(180deg,#fff_0%,#fff8f4_100%)]">
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-end justify-between gap-5 mb-10 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-[11.5px] text-orange uppercase tracking-[2.5px] font-bold mb-2.5 before:content-[''] before:w-5 before:h-0.5 before:bg-orange">
              Real Vehicle Gallery
            </div>
            <h2 className="font-montserrat font-extrabold italic text-[clamp(1.8rem,3vw,2.8rem)] text-navy leading-[1.1]">
              See The <span className="text-orange">Actual Cars</span>
            </h2>
            <p className="text-muted text-[14.5px] leading-[1.75] max-w-[560px] mt-2.5">
              Real photos from our fleet, so customers can preview the vehicles they will actually travel in across New Zealand.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-orange/20 bg-white px-4 py-2 text-[12px] font-semibold text-navy shadow-sm">
            <Camera size={14} className="text-orange" />
            {images.length} photos
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 rounded-[24px] bg-white border border-black/10 animate-pulse" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-orange/30 bg-white/80 px-6 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange/10">
              <Camera size={20} className="text-orange" />
            </div>
            <p className="text-[15px] font-semibold text-navy">No gallery photos yet</p>
            <p className="mt-1 text-[13px] text-muted">
              Upload real vehicle photos in the admin panel and they will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[180px]">
            {images.slice(0, 8).map((image, index) => {
              const featured = index === 0 || index === 5
              return (
                <button
                  key={image.path}
                  type="button"
                  onClick={() => setSelectedImage(image)}
                  className={`group relative overflow-hidden rounded-[24px] border border-black/10 bg-white text-left shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-1 hover:border-orange/30 hover:shadow-[0_18px_36px_rgba(232,67,26,0.16)] ${featured ? 'col-span-2 row-span-2' : ''}`}
                >
                  <img
                    src={image.url}
                    alt={image.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-transparent to-transparent opacity-90" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
                    <div className="text-white">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-white/70">YITU Gallery</div>
                      <div className="mt-1 text-[13px] font-semibold">
                        Vehicle Photo {String(index + 1).padStart(2, '0')}
                      </div>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-sm">
                      <Expand size={15} />
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={selectedImage.url} alt={selectedImage.name} className="max-h-[80vh] w-full object-contain bg-black" />
          </div>
        </div>
      )}
    </section>
  )
}
