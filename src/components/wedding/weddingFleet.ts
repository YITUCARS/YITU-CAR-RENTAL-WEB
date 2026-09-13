export type WeddingFleetCar = {
    id: string
    name: string
    body: string
    note: string
    image: string
}

// The wedding page keeps its own curated fleet: these are the decorated cars we
// photograph and quote by enquiry, independent of the rental booking system.
export const WEDDING_FLEET: WeddingFleetCar[] = [
    {
        id: 'maserati-ghibli',
        name: 'Maserati Ghibli',
        body: 'Luxury sedan',
        note: 'The bridal car. Low, dramatic and unmistakable in photographs.',
        image: '/wedding/maserati-ghibli.webp',
    },
    {
        id: 'porsche-cayenne',
        name: 'Porsche Cayenne',
        body: 'Luxury SUV',
        note: 'A high, easy step in a full gown, with room for the bridal party.',
        image: '/wedding/porsche-cayenne.webp',
    },
    {
        id: 'bmw-5-series',
        name: 'BMW 5 Series',
        body: 'Executive sedan',
        note: 'Quiet and understated for the groom, parents or guests of honour.',
        image: '/wedding/bmw-5-series.webp',
    },
    {
        id: 'audi-rs6',
        name: 'Audi RS6 Avant',
        body: 'Performance wagon',
        note: 'Room for the dress, florals and camera gear without losing the look.',
        image: '/wedding/audi-rs6.webp',
    },
    {
        id: 'bmw-m340i',
        name: 'BMW M340i Touring',
        body: 'Sports wagon',
        note: 'A sharper companion car for the groomsmen or the photography crew.',
        image: '/wedding/bmw-m340i.webp',
    },
    {
        id: 'mini-countryman',
        name: 'MINI Countryman',
        body: 'Compact SUV',
        note: 'A lighter, playful choice for the just-married getaway.',
        image: '/wedding/mini-countryman.webp',
    },
    {
        id: 'mg-qs',
        name: 'MG QS',
        body: 'Seven-seat SUV',
        note: 'Keeps family and out-of-town guests moving between venues.',
        image: '/wedding/mg-qs.webp',
    },
]
