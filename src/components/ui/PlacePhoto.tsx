'use client'

import { useEffect, useState } from 'react'

interface PlacePhotoProps {
  placeId: string | null
  width?: number
  className?: string
  style?: React.CSSProperties
  fallbackInitials?: string
}

export default function PlacePhoto({ placeId, width = 400, className, style, fallbackInitials }: PlacePhotoProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!placeId) { setError(true); return }
    setUrl(`/api/place-photo?placeId=${encodeURIComponent(placeId)}&w=${width}`)
  }, [placeId, width])

  if (error || !url) {
    return (
      <div
        className={className}
        style={{ ...style, background: '#0D4F57', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span style={{ color: '#C9A86A', fontWeight: 600, fontSize: 16 }}>
          {fallbackInitials ?? '?'}
        </span>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt="Restaurant"
      className={className}
      style={{ ...style, objectFit: 'cover' }}
      onError={() => setError(true)}
    />
  )
}
