'use client'

type Hotspot = {
    id: string
    name: string
    tagline: string
    x: number
    y: number
    w: number
    h: number
}

// Coordinates are percentages of the hero image itself (not of the section),
// so they stay locked to each car while `cover` crops the edges.
const HOTSPOTS: Hotspot[] = [
    { id: 'porsche', name: 'Porsche Cayenne', tagline: 'Bridal party SUV', x: 3.5, y: 39.5, w: 20.5, h: 24 },
    { id: 'audi', name: 'Audi RS6', tagline: 'Dress, flowers & camera gear', x: 24.5, y: 41, w: 17.5, h: 22.5 },
    { id: 'maserati', name: 'Maserati Ghibli', tagline: 'The bridal car', x: 42.5, y: 42, w: 15, h: 23 },
    { id: 'bmw', name: 'BMW 5 Series', tagline: 'Groom & groomsmen', x: 59.3, y: 42, w: 17.5, h: 23 },
    { id: 'mini', name: 'MINI Countryman', tagline: 'Just-married getaway', x: 76, y: 41, w: 19.5, h: 22.5 },
]

export default function WeddingHeroHotspots({ onSelect }: { onSelect: () => void }) {
    return (
        <div className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block">
            {/* Auto-sized to exactly match the `cover` painted area of the hero image. */}
            <div className="absolute left-1/2 top-1/2 h-auto w-auto min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 [aspect-ratio:4614/2597]">
                {HOTSPOTS.map(spot => {
                    const flipUp = spot.y > 45
                    return (
                        <div
                            key={spot.id}
                            className="group pointer-events-auto absolute cursor-pointer outline-none"
                            style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%` }}
                            tabIndex={0}
                            role="button"
                            aria-label={spot.name}
                            onClick={onSelect}
                            onKeyDown={event => { if (event.key === 'Enter') onSelect() }}
                        >
                            <div
                                className={`pointer-events-none absolute left-1/2 z-10 w-[236px] -translate-x-1/2 opacity-0 transition-all duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 ${flipUp ? 'bottom-[calc(100%+10px)] translate-y-2 group-hover:translate-y-0 group-focus-visible:translate-y-0' : 'top-[calc(100%+10px)] -translate-y-2 group-hover:translate-y-0 group-focus-visible:translate-y-0'}`}
                            >
                                <div className="rounded-2xl border border-white/25 bg-black/45 px-4 py-3.5 text-center text-white shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
                                    <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-orange">{spot.tagline}</div>
                                    <div className="mt-1.5 font-syne text-[15px] font-extrabold leading-tight">{spot.name}</div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
