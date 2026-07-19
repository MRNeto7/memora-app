import { NextRequest, NextResponse } from 'next/server'

const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/

// Google's weekly schedule for a place: periods of open/close in venue-local
// time ("HHMM" strings, day 0-6 = Sun-Sat). 24/7 venues have one period with
// open at 0000 Sunday and no close.
interface GooglePeriod {
  open: { day: number; time: string }
  close?: { day: number; time: string }
}

// Compute open-now at request time from the cached weekly schedule + the
// venue's UTC offset — so a long-cached response never shows a stale badge.
function computeOpenNow(periods: GooglePeriod[] | undefined, utcOffsetMinutes: number | undefined): boolean | null {
  if (!periods || periods.length === 0 || utcOffsetMinutes === undefined) return null
  if (periods.length === 1 && periods[0].open.time === '0000' && !periods[0].close) return true // 24/7

  const nowVenue = new Date(Date.now() + utcOffsetMinutes * 60_000)
  const WEEK = 7 * 1440
  const t = nowVenue.getUTCDay() * 1440 + nowVenue.getUTCHours() * 60 + nowVenue.getUTCMinutes()

  for (const p of periods) {
    if (!p.close) continue
    const start = p.open.day * 1440 + parseInt(p.open.time.slice(0, 2), 10) * 60 + parseInt(p.open.time.slice(2), 10)
    let end = p.close.day * 1440 + parseInt(p.close.time.slice(0, 2), 10) * 60 + parseInt(p.close.time.slice(2), 10)
    if (end <= start) end += WEEK // overnight span wrapping the week boundary
    if ((t >= start && t < end) || (t + WEEK >= start && t + WEEK < end)) return true
  }
  return false
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get('placeId')
  if (!placeId || !PLACE_ID_PATTERN.test(placeId)) return NextResponse.json({})

  const key = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) {
    console.error('Google Maps API key missing')
    return NextResponse.json({}, { status: 500 })
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,formatted_phone_number,opening_hours,utc_offset,rating,user_ratings_total,price_level&key=${key}`

  try {
    // The billed Google call is cached for 7 days (Vercel data cache, shared
    // across users and instances) — venue facts barely change, and this was
    // the app's single biggest per-user API cost when fetched per sheet-open.
    const res = await fetch(url, { next: { revalidate: 604800 } })
    const data = await res.json()
    if (data.status === 'OK') {
      const result = data.result
      return NextResponse.json({
        website: result?.website ?? null,
        phone: result?.formatted_phone_number ?? null,
        openNow: computeOpenNow(result?.opening_hours?.periods, result?.utc_offset),
        rating: result?.rating ?? null,
        totalRatings: result?.user_ratings_total ?? null,
        priceLevel: result?.price_level ?? null,
      }, {
        // Browsers may reuse for 30min; no CDN caching so openNow stays
        // freshly computed — the function run is cheap, the Google call isn't.
        headers: { 'Cache-Control': 'public, max-age=1800' },
      })
    }
    return NextResponse.json({})
  } catch {
    return NextResponse.json({})
  }
}
