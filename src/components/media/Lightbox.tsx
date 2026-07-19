'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSignedPhotoUrls } from '@/lib/storage'

interface LightboxPhoto {
  id: string
  storage_path: string
}

interface LightboxProps {
  photos: LightboxPhoto[]
  initialIndex: number
  onClose: () => void
}

export default function Lightbox({ photos, initialIndex, onClose }: LightboxProps) {
  const [current, setCurrent] = useState(initialIndex)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const supabase = createClient()

  // Load signed URLs for all photos in one batched request
  useEffect(() => {
    const pending = photos.filter(p => !urls[p.id])
    if (pending.length === 0) return
    getSignedPhotoUrls(supabase, pending.map(p => p.storage_path)).then(map => {
      setUrls(prevUrls => {
        const next = { ...prevUrls }
        for (const p of pending) {
          const url = map.get(p.storage_path)
          if (url) next[p.id] = url
        }
        return next
      })
    })
  }, [photos])

  const prev = useCallback(() => setCurrent(c => Math.max(0, c - 1)), [])
  const next = useCallback(() => setCurrent(c => Math.min(photos.length - 1, c + 1)), [photos.length])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onClose])

  // Touch swipe
  useEffect(() => {
    let startX = 0
    function onTouchStart(e: TouchEvent) { startX = e.touches[0].clientX }
    function onTouchEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - startX
      if (dx > 50) prev()
      if (dx < -50) next()
    }
    window.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [prev, next])

  const photo = photos[current]
  const url = urls[photo?.id]
  const isVideo = photo?.storage_path.match(/\.(mp4|mov|webm|m4v)$/i)

  return (
    <div
      className="backdrop-enter fixed inset-0 z-[100] flex flex-col"
      style={{ background: '#000', overflow: 'hidden', paddingBottom: 'var(--safe-bottom)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}>
        <button onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 18 }}>
          ✕
        </button>
        {photos.length > 1 && (
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {current + 1} / {photos.length}
          </span>
        )}
        <div style={{ width: 36 }} />
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center px-4 relative" style={{ minHeight: 0, marginBottom: 0 }}>
        {!url ? (
          <div className="w-16 h-16 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
        ) : isVideo ? (
          <video
            src={url}
            controls
            playsInline
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, display: 'block' }}
          />
        ) : (
          <img
            src={url}
            alt=""
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 8,
              userSelect: 'none',
              display: 'block',
            }}
            draggable={false}
          />
        )}

        {/* Side tap zones */}
        {current > 0 && (
          <button onClick={prev}
            className="absolute left-0 top-0 bottom-0 flex items-center pl-3"
            style={{ width: '20%', background: 'transparent' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 20 }}>‹</div>
          </button>
        )}
        {current < photos.length - 1 && (
          <button onClick={next}
            className="absolute right-0 top-0 bottom-0 flex items-center justify-end pr-3"
            style={{ width: '20%', background: 'transparent' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 20 }}>›</div>
          </button>
        )}
      </div>

      {/* Bottom dots + thumbnails */}
      {photos.length > 1 && (
        <div className="flex-shrink-0 pt-3" style={{ paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom) + 8px))', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
          {/* Dot indicators */}
          <div className="flex justify-center gap-1.5 mb-3">
            {photos.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className="rounded-full transition-all"
                style={{
                  width: i === current ? 20 : 6,
                  height: 6,
                  background: i === current ? 'var(--gold-500)' : 'rgba(255,255,255,0.4)'
                }} />
            ))}
          </div>

          {/* Thumbnail strip */}
          <div className="flex justify-center gap-2 px-4 overflow-x-auto">
            {photos.map((p, i) => {
              const thumbUrl = urls[p.id]
              const isVid = p.storage_path.match(/\.(mp4|mov|webm|m4v)$/i)
              return (
                <button key={p.id} onClick={() => setCurrent(i)}
                  className="flex-shrink-0 rounded-lg overflow-hidden"
                  style={{
                    width: 52, height: 52,
                    border: i === current ? '2px solid var(--gold-500)' : '2px solid transparent',
                    background: '#333',
                    position: 'relative',
                  }}>
                  {thumbUrl && !isVid && (
                    <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  {isVid && (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: '#222' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#C9A86A">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </div>
                  )}
                  {!thumbUrl && !isVid && (
                    <div className="w-full h-full animate-pulse" style={{ background: '#444' }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
