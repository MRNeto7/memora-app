import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!query || query.length < 2) return NextResponse.json({ places: [] })

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Use Text Search API — searches for food/drink establishments specifically
  const locationBias = lat && lng && lat !== '' && lng !== ''
    ? `&location=${lat},${lng}&radius=5000`
    : ''

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=restaurant|bar|cafe|food|bakery|meal_takeaway&key=${key}${locationBias}`

  try {
    const res = await fetch(url)
    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({ places: [] })
    }

    const places = data.results.slice(0, 6).map((p: {
      place_id: string
      name: string
      formatted_address: string
      geometry: { location: { lat: number; lng: number } }
      types?: string[]
      rating?: number
    }) => ({
      placeId: p.place_id,
      name: p.name,
      address: p.formatted_address,
      lat: p.geometry.location.lat,
      lng: p.geometry.location.lng,
      rating: p.rating ?? null,
    }))

    return NextResponse.json({ places })
  } catch (err) {
    console.error('Places API error:', err)
    return NextResponse.json({ places: [] }, { status: 500 })
  }
}
