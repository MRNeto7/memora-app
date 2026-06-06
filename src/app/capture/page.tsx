'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CapturePage() {
  const router = useRouter()

  useEffect(() => {
    // On mobile, trigger native camera then redirect to map to save
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile) {
      // Create a hidden file input that opens camera
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*,video/*'
      input.capture = 'environment' // rear camera
      input.onchange = () => {
        // Store selected file reference and go to map to save
        router.push('/?capture=true')
      }
      input.click()
    }
  }, [router])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--stone)', paddingBottom: 'var(--nav-total)' }}
    >
      {/* Camera icon */}
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
        style={{ background: '#0D4F57' }}
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#C9A86A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </div>

      <h1 className="text-xl font-semibold mb-2" style={{ color: '#0D4F57' }}>Capture a memory</h1>
      <p className="text-sm mb-8 leading-relaxed" style={{ color: '#7D878D', maxWidth: 280 }}>
        On your phone, this opens your camera directly. Take a photo of your meal and we'll pin it to the map.
      </p>

      {/* Desktop — trigger file picker */}
      <button
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*,video/*'
          input.multiple = true
          input.onchange = () => router.push('/?capture=true')
          input.click()
        }}
        className="px-8 py-3 rounded-2xl text-white font-semibold text-sm mb-4"
        style={{ background: '#0D4F57' }}
      >
        📷  Open camera / choose photo
      </button>

      <p className="text-xs" style={{ color: '#b0babe' }}>
        Or tap the map tab and press "Save memory"
      </p>

      {/* How it works */}
      <div
        className="mt-10 w-full max-w-sm rounded-2xl p-5 text-left"
        style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.12)' }}
      >
        <p className="text-xs font-semibold mb-3" style={{ color: '#0D4F57' }}>How it works</p>
        {[
          ['📍', 'Location detected automatically from your photo'],
          ['🕐', 'Date and time read from the image'],
          ['🗺️', 'Restaurant matched to Google Maps'],
          ['⭐', 'Add a rating and notes in seconds'],
        ].map(([icon, text]) => (
          <div key={text} className="flex items-start gap-3 mb-2">
            <span style={{ fontSize: 16 }}>{icon}</span>
            <p className="text-xs leading-relaxed" style={{ color: '#7D878D' }}>{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
