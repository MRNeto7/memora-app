'use client'

import { useState } from 'react'

interface PlacePhotoProps {
  placeId: string | null
  width?: number
  className?: string
  style?: React.CSSProperties
  fallbackInitials?: string
}

// Loads venue photos through /api/place-photo, which the CDN and browser
// cache — one Google Places billing event per venue per cache window,
// instead of a Place Details call on every card render.
export default function PlacePhoto({ placeId, width = 400, style, fallbackInitials }: PlacePhotoProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(placeId) && !failed

  return (
    <div style={{
      ...style,
      position: 'relative',
      background: '#1a3a40',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      <span style={{ color: '#C9A86A', fontWeight: 700, fontSize: typeof style?.width === 'number' && style.width < 60 ? 13 : 18, letterSpacing: 1 }}>
        {fallbackInitials ?? '?'}
      </span>
      {showImage && (
        <img
          src={`/api/place-photo?placeId=${encodeURIComponent(placeId!)}&w=${width}`}
          alt="Restaurant"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
        />
      )}
    </div>
  )
}
