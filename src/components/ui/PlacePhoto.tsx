'use client'

import { useEffect, useState } from 'react'

interface PlacePhotoProps {
  placeId: string | null
  width?: number
  className?: string
  style?: React.CSSProperties
  fallbackInitials?: string
}

// Resolves the venue photo client-side via the Maps JS Places SDK. The
// server proxy approach failed because the Google key is HTTP-referrer
// restricted (browser-only), so server-to-server calls were rejected.
// A module-level cache keeps it to one Place Details lookup per venue per
// session instead of one per card render.
const urlCache = new Map<string, string | null>()

export default function PlacePhoto({ placeId, width = 400, style, fallbackInitials }: PlacePhotoProps) {
  const [url, setUrl] = useState<string | null>(placeId ? urlCache.get(placeId) ?? null : null)
  const [tried, setTried] = useState(placeId ? urlCache.has(placeId) : true)

  useEffect(() => {
    if (!placeId) return
    // Cache hit — apply on a microtask so it isn't a synchronous in-effect setState
    if (urlCache.has(placeId)) {
      queueMicrotask(() => { setUrl(urlCache.get(placeId) ?? null); setTried(true) })
      return
    }

    let cancelled = false
    function tryLoad() {
      if (cancelled || !placeId) return
      if (!window.google?.maps?.places) { setTimeout(tryLoad, 300); return }
      try {
        const div = document.createElement('div')
        const service = new window.google.maps.places.PlacesService(div)
        service.getDetails(
          { placeId, fields: ['photos'] },
          (result, status) => {
            if (cancelled) return
            let photoUrl: string | null = null
            if (status === window.google.maps.places.PlacesServiceStatus.OK && result?.photos?.[0]) {
              photoUrl = result.photos[0].getUrl({ maxWidth: width, maxHeight: width })
            }
            urlCache.set(placeId, photoUrl)
            setUrl(photoUrl)
            setTried(true)
          }
        )
      } catch {
        queueMicrotask(() => setTried(true))
      }
    }
    tryLoad()
    return () => { cancelled = true }
  }, [placeId, width])

  if (!url) {
    return (
      <div style={{
        ...style,
        background: tried ? '#1a3a40' : '#0D4F57',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {tried ? (
          <span style={{ color: '#C9A86A', fontWeight: 700, fontSize: typeof style?.width === 'number' && style.width < 60 ? 13 : 18, letterSpacing: 1 }}>
            {fallbackInitials ?? '?'}
          </span>
        ) : (
          <div className="animate-pulse" style={{ width: '60%', height: '60%', borderRadius: 8, background: 'rgba(201,168,106,0.2)' }} />
        )}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt="Restaurant"
      style={{ ...style, display: 'block' }}
      onError={() => { if (placeId) urlCache.delete(placeId); setUrl(null); setTried(true) }}
    />
  )
}
