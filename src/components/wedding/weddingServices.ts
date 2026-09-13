import { Camera, CarFront, Clock3, Flower2, Route, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type WeddingService = {
    id: string
    title: string
    blurb: string
    detail: string
    icon: LucideIcon
}

export const WEDDING_SERVICES: WeddingService[] = [
    {
        id: 'decoration',
        title: 'Wedding car decoration',
        blurb: 'Ribbons, florals and bridal plates',
        detail: 'Silk ribbons, fresh or silk floral arrangements and bridal number plates, styled to match your colour palette and fitted before pick-up.',
        icon: Flower2,
    },
    {
        id: 'chauffeur',
        title: 'Professional wedding chauffeur',
        blurb: 'Suited driver, on your run sheet',
        detail: 'A suited driver who works to your timeline, handles doors and umbrellas, and keeps the day moving between ceremony, photos and reception.',
        icon: UserRound,
    },
    {
        id: 'photography',
        title: 'Photography & videography car',
        blurb: 'A car for the crew, and for the shoot',
        detail: 'A dedicated vehicle for your photographer and videographer, plus posed sessions with the fleet at your venue or a location of your choice.',
        icon: Camera,
    },
    {
        id: 'convoy',
        title: 'Matched multi-car convoy',
        blurb: 'Two to five cars, one styling',
        detail: 'A colour-matched convoy so the couple, bridal party and immediate family all arrive together, decorated to the same brief.',
        icon: CarFront,
    },
    {
        id: 'transfers',
        title: 'Guest & family transfers',
        blurb: 'Airport, hotel and venue runs',
        detail: 'Transfers for parents, the bridal party and out-of-town guests, coordinated around the ceremony and reception times.',
        icon: Route,
    },
    {
        id: 'fullDay',
        title: 'Full-day & multi-day hire',
        blurb: 'Morning prep to the last dance',
        detail: 'Keep the car for the whole day, the rehearsal dinner, or across a wedding weekend, including next-morning departures.',
        icon: Clock3,
    },
]
