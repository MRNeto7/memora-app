'use client'

import { useEffect, useRef, useState } from 'react'
import Portal from '@/components/ui/Portal'
import Icon from '@/components/ui/Icon'

// In-app live camera (Instagram/TikTok-style): a full-screen viewfinder using
// the device camera via getUserMedia, with a shutter, a flip-camera control,
// and a library fallback. Captured frames are returned as JPEG Files.
export default function CameraCapture({ onCapture, onFiles, onClose }: {
  onCapture: (file: File) => void
  onFiles: (files: FileList | null) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        setError(false)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
          setReady(true)
        }
      } catch {
        if (active) setError(true)
      }
    }
    start()
    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [facing])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (blob) onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: '#000' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover',
            transform: facing === 'user' ? 'scaleX(-1)' : 'none',
          }}
        />

        {/* Fallback when the camera can't start */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center" style={{ background: '#0D4F57' }}>
            <p className="text-white text-sm mb-1 font-semibold">Camera unavailable</p>
            <p className="text-xs mb-6 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Allow camera access in Settings, or choose a photo from your library instead.
            </p>
            <label className="px-6 py-3 rounded-2xl text-sm font-semibold cursor-pointer" style={{ background: '#C9A86A', color: '#0D4F57' }}>
              Choose from library
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => onFiles(e.target.files)} />
            </label>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute left-0 right-0 flex items-center justify-between px-5" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          {!error && (
            <button onClick={() => { setReady(false); setFacing(f => f === 'environment' ? 'user' : 'environment') }} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
          )}
        </div>

        {/* Bottom controls */}
        {!error && (
          <div className="absolute left-0 right-0 flex items-center justify-between px-10" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
            {/* Library */}
            <label className="w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <Icon name="image" size={22} color="#fff" />
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => onFiles(e.target.files)} />
            </label>
            {/* Shutter */}
            <button onClick={capture} disabled={!ready} aria-label="Take photo"
              className="rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ width: 76, height: 76, background: 'rgba(255,255,255,0.25)', border: '4px solid #fff', opacity: ready ? 1 : 0.5 }}>
              <div style={{ width: 58, height: 58, borderRadius: '50%', background: '#fff' }} />
            </button>
            {/* Spacer to keep the shutter centred */}
            <div style={{ width: 48 }} className="flex-shrink-0" />
          </div>
        )}
      </div>
    </Portal>
  )
}
