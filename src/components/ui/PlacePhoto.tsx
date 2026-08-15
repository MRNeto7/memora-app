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

// On-device cache: one billed Place Details lookup per venue per DEVICE
// per month instead of per session. 30-day TTL keeps cached place content
// inside Google's refresh policy; place IDs themselves may be stored freely.
const STORE_KEY = 'mimora-place-photos-v1'
const STORE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const STORE_MAX = 400

type StoredPhoto = { u: string | null; t: number }

function readStore(): Record<string, StoredPhoto> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (!raw) return {}
    const parsed: Record<string, StoredPhoto> = JSON.parse(raw)
    const now = Date.now()
    for (const k of Object.keys(parsed)) {
      if (now - parsed[k].t > STORE_TTL_MS) delete parsed[k]
    }
    return parsed
  } catch { return {} }
}

function writeStore(placeId: string, url: string | null) {
  if (typeof window === 'undefined') return
  try {
    const store = readStore()
    store[placeId] = { u: url, t: Date.now() }
    const keys = Object.keys(store)
    if (keys.length > STORE_MAX) {
      keys.sort((a, b) => store[a].t - store[b].t)
      for (const k of keys.slice(0, keys.length - STORE_MAX)) delete store[k]
    }
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch { /* storage full — session cache still works */ }
}

function dropStored(placeId: string) {
  if (typeof window === 'undefined') return
  try {
    const store = readStore()
    delete store[placeId]
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch { /* ignore */ }
}

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

    // Device cache next — a fresh entry skips the billed lookup entirely
    const stored = readStore()[placeId]
    if (stored) {
      urlCache.set(placeId, stored.u)
      queueMicrotask(() => { setUrl(stored.u); setTried(true) })
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
            writeStore(placeId, photoUrl)
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
        background: 'var(--stone-200)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {tried ? (
          <span style={{ color: 'var(--slate)', fontWeight: 700, fontSize: typeof style?.width === 'number' && style.width < 60 ? 13 : 18, letterSpacing: 1 }}>
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
      onError={() => { if (placeId) { urlCache.delete(placeId); dropStored(placeId) } setUrl(null); setTried(true) }}
    />
  )
}
