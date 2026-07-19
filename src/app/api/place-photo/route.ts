import { NextRequest, NextResponse } from 'next/server'

const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get('placeId')
  const width = Math.min(Math.max(Number(searchParams.get('w')) || 400, 50), 1600)

  if (!placeId || !PLACE_ID_PATTERN.test(placeId)) return NextResponse.json({ url: null })

  const key = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) {
    console.error('Google Maps API key missing')
    return NextResponse.json({ url: null }, { status: 500 })
  }

  try {
    // Step 1: get photo reference from place details
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${key}`,
      { cache: 'force-cache' }
    )
    const details = await detailsRes.json()
    const photoRef = details.result?.photos?.[0]?.photo_reference

    if (!photoRef) {
      // Cache "no photo" too — otherwise every card render re-asks Google
      return NextResponse.json({ url: null }, {
        status: 404,
        headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' },
      })
    }

    // Step 2: build the photo URL — redirect to actual image
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${width}&photo_reference=${photoRef}&key=${key}`

    // Fetch the photo and proxy it back (avoids CORS and referrer issues)
    const imgRes = await fetch(photoUrl)
    const buffer = await imgRes.arrayBuffer()
    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        // Browser caches a day; CDN holds a month so repeat visitors never hit Google
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400',
      },
    })
  } catch {
    console.error('Place photo fetch failed')
    return NextResponse.json({ url: null })
  }
}
