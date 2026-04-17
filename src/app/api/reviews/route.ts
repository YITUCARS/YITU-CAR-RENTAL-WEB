export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const PLACE_ID = 'ChIJJxIZZNn1MW0Rk4kIt7fYHOc'
const API_KEY = process.env.GOOGLE_PLACES_API_KEY!

export async function GET() {
    try {
        const url = `https://places.googleapis.com/v1/places/${PLACE_ID}?fields=rating,userRatingCount,reviews&languageCode=en&key=${API_KEY}`

        const res = await fetch(url, {
            headers: {
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
            },
            next: { revalidate: 3600 },
        })

        const data = await res.json()
        console.log('Places API v1 response:', JSON.stringify(data, null, 2))

        if (data.error) {
            return NextResponse.json({ error: data.error.message }, { status: 500 })
        }

        const rating = data.rating
        const user_ratings_total = data.userRatingCount
        const reviews = (data.reviews ?? [])
            .filter((r: any) => r.rating >= 4)
            .slice(0, 5)
            .map((r: any) => ({
                author_name: r.authorAttribution?.displayName ?? 'Anonymous',
                rating: r.rating,
                text: r.text?.text ?? '',
                relative_time_description: r.relativePublishTimeDescription ?? '',
                profile_photo_url: r.authorAttribution?.photoUri ?? '',
            }))

        return NextResponse.json({ rating, user_ratings_total, reviews })
    } catch (err: any) {
        console.log('Error:', err.message)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}