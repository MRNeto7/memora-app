import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!query || query.length < 2) return NextResponse.json({ places: [] })

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!key) {
    console.error('Google Maps API key missing')
    return NextResponse.json({ places: [], error: 'API key missing' })
  }

  // Location bias — bias results toward where the photo was taken
  const locationBias = lat && lng && lat !== '' && lng !== ''
    ? `&location=${lat},${lng}&radius=10000`
    : ''

  // Text Search — type must be a single type, not pipe-separated
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=restaurant&key=${key}${locationBias}`

  console.log('Places API request:', url.replace(key, 'REDACTED'))

  try {
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()

    console.log('Places API status:', data.status)
    console.log('Places results count:', data.results?.length ?? 0)

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Places API error status:', data.status, data.error_message)
      return NextResponse.json({ places: [], error: data.status })
    }

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({ places: [] })
    }

    const places = data.results.slice(0, 6).map((p: {
      place_id: string
      name: string
      formatted_address: string
      geometry: { location: { lat: number; lng: number } }
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
    console.error('Places API fetch error:', err)
    return NextResponse.json({ places: [], error: 'fetch failed' }, { status: 500 })
  }
}
