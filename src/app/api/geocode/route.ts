import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing lat/lng' }, { status: 400 })
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
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
