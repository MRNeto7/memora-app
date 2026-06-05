'use client'

import { useEffect, useState } from 'react'

interface PlacePhotoProps {
  placeId: string | null
  width?: number
  className?: string
  style?: React.CSSProperties
  fallbackInitials?: string
}

export default function PlacePhoto({ placeId, width = 400, style, fallbackInitials }: PlacePhotoProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!placeId) { setTried(true); return }

    function tryLoad() {
      if (!window.google?.maps?.places) {
        setTimeout(tryLoad, 300)
        return
      }
      if (!placeId) { setTried(true); return }

      try {
        // Use a hidden div as the PlacesService target
        const div = document.createElement('div')
        const service = new window.google.maps.places.PlacesService(div)
        service.getDetails(
          { placeId: placeId as string, fields: ['photos'] },
          (result, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && result?.photos?.[0]) {
              const photoUrl = result.photos[0].getUrl({ maxWidth: width, maxHeight: width })
              setUrl(photoUrl)
            }
            setTried(true)
          }
        )
      } catch {
        setTried(true)
      }
    }

    tryLoad()
  }, [placeId, width])

  // Fallback — show initials while loading or if no photo
  if (!url) {
    return (
      <div style={{
        ...style,
        background: tried ? '#1a3a40' : '#0D4F57',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {tried ? (
          <span style={{ color: '#C9A86A', fontWeight: 700, fontSize: typeof style?.width === 'number' && style.width < 60 ? 13 : 18, letterSpacing: 1 }}>
            {fallbackInitials ?? '?'}
          </span>
        ) : (
          // Loading shimmer
          <div style={{ width: '60%', height: '60%', borderRadius: 8, background: 'rgba(201,168,106,0.2)', animation: 'pulse 1.5s infinite' }} />
        )}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt="Restaurant"
      style={{ ...style, display: 'block' }}
      onError={() => { setUrl(null); setTried(true) }}
    />
  )
}
