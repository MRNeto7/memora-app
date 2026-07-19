import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get('lat'))
  const lng = Number(searchParams.get('lng'))

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'Invalid lat/lng' }, { status: 400 })
  }

  const key = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) {
    console.error('Google Maps API key missing')
    return NextResponse.json({ error: 'API key missing' }, { status: 500 })
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&result_type=restaurant|bar|cafe|food`

  try {
    const res = await fetch(url)
    const data = await res.json()

    if (data.results && data.results.length > 0) {
      const place = data.results[0]
      return NextResponse.json({
        name: place.name ?? place.formatted_address,
        address: place.formatted_address,
        placeId: place.place_id,
      })
    }

    return NextResponse.json({ name: null })
  } catch {
    return NextResponse.json({ error: 'Geocode failed' }, { status: 500 })
  }
}
