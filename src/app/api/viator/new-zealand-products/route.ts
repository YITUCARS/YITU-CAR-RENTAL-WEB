export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

type TicketProduct = {
  code: string
  title: string
  subtitle: string
  imageUrl: string
  destination: string
  priceText: string
  ratingText: string
  durationText: string
  bookingUrl: string
}

const fallbackProducts: TicketProduct[] = [
  {
    code: 'nz-milford-sound',
    title: 'Milford Sound Cruise and Day Tour',
    subtitle: 'Scenic coach, fjord cruise and classic Fiordland viewpoints.',
    imageUrl: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?auto=format&fit=crop&w=1200&q=80',
    destination: 'Fiordland',
    priceText: 'View price',
    ratingText: 'Popular',
    durationText: 'Full day',
    bookingUrl: 'https://www.viator.com/New-Zealand/d24-ttd',
  },
  {
    code: 'nz-glowworm',
    title: 'Waitomo Glowworm Cave Tickets',
    subtitle: 'A gentle underground boat experience through the glowworm grotto.',
    imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    destination: 'Waitomo',
    priceText: 'View price',
    ratingText: 'Family pick',
    durationText: '45 min',
    bookingUrl: 'https://www.viator.com/New-Zealand/d24-ttd',
  },
  {
    code: 'nz-queenstown',
    title: 'Queenstown Adventure Experiences',
    subtitle: 'Jet boat, lake cruise, skyline gondola and iconic day trips.',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80',
    destination: 'Queenstown',
    priceText: 'View price',
    ratingText: 'Top rated',
    durationText: 'Flexible',
    bookingUrl: 'https://www.viator.com/Queenstown/d407-ttd',
  },
]

function language(value: string | null) {
  const raw = String(value || '').toLowerCase()
  return raw.startsWith('zh') ? 'zh-CN' : 'en-NZ'
}

function text(value: any) {
  return String(value || '').trim()
}

function firstImage(product: any) {
  const image = product?.images?.[0]
  const variants = image?.variants
  if (Array.isArray(variants) && variants.length) {
    return text(variants[variants.length - 1]?.url || variants[0]?.url)
  }
  return text(image?.url || product?.thumbnailHiResURL || product?.thumbnailURL)
}

function price(product: any) {
  const summary = product?.pricing?.summary || product?.pricingInfo?.summary
  const fromPrice = summary?.fromPrice || product?.fromPrice
  const currency = summary?.currency || product?.currency || 'NZD'
  if (!fromPrice) return ''
  return `From ${currency} ${fromPrice}`
}

function rating(product: any) {
  const score = product?.reviews?.combinedAverageRating || product?.rating
  if (!score) return ''
  return `★ ${Number(score).toFixed(1)}`
}

function duration(product: any) {
  const fixed = product?.duration?.fixedDurationInMinutes
  if (fixed) {
    const hours = Math.round(Number(fixed) / 60)
    return hours >= 1 ? `${hours}h` : `${fixed}min`
  }
  const variable = product?.duration?.variableDurationFromMinutes
  if (variable) return `${Math.round(Number(variable) / 60)}h+`
  return ''
}

function mapProduct(product: any): TicketProduct {
  return {
    code: text(product?.productCode || product?.code),
    title: text(product?.title),
    subtitle: text(product?.description || product?.shortDescription),
    imageUrl: firstImage(product),
    destination: text(product?.destinationName || product?.primaryDestinationName || 'New Zealand'),
    priceText: price(product),
    ratingText: rating(product),
    durationText: duration(product),
    bookingUrl: text(product?.productUrl || product?.url || product?.webURL),
  }
}

async function searchViator(query: string, locale: string) {
  const key = process.env.VIATOR_API_KEY
  if (!key) return null

  const body = {
    searchTerm: query || 'New Zealand tours tickets',
    currency: 'NZD',
    productFiltering: {
      destination: 'New Zealand',
    },
    searchTypes: [
      {
        searchType: 'PRODUCTS',
        pagination: { start: 1, count: 12 },
      },
    ],
  }

  const response = await fetch('https://api.viator.com/partner/search/freetext', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json;version=2.0',
      'Accept-Language': locale,
      'exp-api-key': key,
    },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) {
    console.warn('[viator] search failed:', JSON.stringify(data?.error || data))
    return null
  }

  const rawProducts =
    data?.products?.results ||
    data?.products ||
    data?.searchTypes?.find((item: any) => item?.searchType === 'PRODUCTS')?.results ||
    data?.results ||
    []
  if (!Array.isArray(rawProducts)) return null
  return rawProducts.map(mapProduct).filter((item) => item.title)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const locale = language(url.searchParams.get('locale'))
  const query = text(url.searchParams.get('q'))
  const products = await searchViator(query, locale).catch((err) => {
    console.error('[viator] proxy error:', err.message)
    return null
  })

  return NextResponse.json({
    success: true,
    source: products?.length ? 'viator' : 'fallback',
    products: products?.length ? products : fallbackProducts,
  })
}
