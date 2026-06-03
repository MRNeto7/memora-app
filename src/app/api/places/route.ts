import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!query) return NextResponse.json({ places: [] })

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Build location bias if we have coords
  const locationBias = lat && lng
    ? `&locationbias=circle:5000@${lat},${lng}`
    : ''

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=establishment&key=${key}${locationBias}`

  try {
    const res = await fetch(url)
    const data = await res.json()

    if (!data.predictions) return NextResponse.json({ places: [] })

    // Get details for each prediction to get lat/lng
    const places = await Promise.all(
      data.predictions.slice(0, 5).map(async (p: { place_id: string; description: string; structured_formatting: { main_text: string; secondary_text: string } }) => {
        const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=geometry,name,formatted_address&key=${key}`
        const detailRes = await fetch(detailUrl)
        const detail = await detailRes.json()
        const loc = detail.result?.geometry?.location

        return {
          placeId: p.place_id,
          name: p.structured_formatting.main_text,
          address: p.structured_formatting.secondary_text,
          lat: loc?.lat ?? null,
          lng: loc?.lng ?? null,
        }
      })
    )

    return NextResponse.json({ places })
  } catch (err) {
    console.error('Places API error:', err)
    return NextResponse.json({ places: [] })
  }
}
