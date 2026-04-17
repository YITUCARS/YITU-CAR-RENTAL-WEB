import { NextResponse } from 'next/server'

const PLACE_ID = 'ChIJJxIZZNn1MW0Rk4kIt7fYHOc'
const API_KEY = 'AIzaSyBYIVPSErzqgQqXcJmv7M6ZFNrcrICXwp4'

export async function GET() {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=name,rating,reviews,user_ratings_total&language=en&key=${API_KEY}`

        const res = await fetch(url, { next: { revalidate: 3600 } }) // 每小时刷新一次缓存
        const data = await res.json()

        if (data.status !== 'OK') {
            return NextResponse.json({ error: data.status }, { status: 500 })
        }

        const { rating, user_ratings_total, reviews } = data.result

        // 只返回 5 星 + 4 星评论，最多 5 条
        const filtered = (reviews ?? [])
            .filter((r: any) => r.rating >= 4)
            .slice(0, 5)

        return NextResponse.json({ rating, user_ratings_total, reviews: filtered })
    } catch (err) {
        return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
    }
}