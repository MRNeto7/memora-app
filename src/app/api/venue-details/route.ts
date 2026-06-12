import { NextRequest, NextResponse } from 'next/server'

const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get('placeId')
  if (!placeId || !PLACE_ID_PATTERN.test(placeId)) return NextResponse.json({})

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) {
    console.error('Google Maps API key missing')
    return NextResponse.json({}, { status: 500 })
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,formatted_phone_number,opening_hours,rating,user_ratings_total,price_level&key=${key}`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()
    if (data.status === 'OK') {
      return NextResponse.json({
        website: data.result?.website ?? null,
        phone: data.result?.formatted_phone_number ?? null,
        openNow: data.result?.opening_hours?.open_now ?? null,
        rating: data.result?.rating ?? null,
        totalRatings: data.result?.user_ratings_total ?? null,
        priceLevel: data.result?.price_level ?? null,
      })
    }
    return NextResponse.json({})
  } catch {
    return NextResponse.json({})
  }
}
