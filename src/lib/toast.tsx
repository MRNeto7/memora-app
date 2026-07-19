'use client'

import { useEffect, useState } from 'react'

// Tiny event-based toast — call toast('Saved!') from anywhere, no context needed.
// Replaces alert(), which in the Capacitor WebView shows a jarring native
// dialog titled with the Vercel URL.

export type ToastKind = 'success' | 'error' | 'info'
interface ToastItem { id: string; message: string; kind: ToastKind }

export function toast(message: string, kind: ToastKind = 'success') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('mimora-toast', { detail: { message, kind } }))
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    function onToast(e: Event) {
      const { message, kind } = (e as CustomEvent).detail
      const id = Math.random().toString(36).slice(2)
      setItems(prev => [...prev.slice(-2), { id, message, kind }])
      setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 2800)
    }
    window.addEventListener('mimora-toast', onToast)
    return () => window.removeEventListener('mimora-toast', onToast)
  }, [])

  if (items.length === 0) return null

  return (
    <div
      className="fixed left-0 right-0 z-[200] flex flex-col items-center gap-2 pointer-events-none px-6"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      {items.map(t => (
        <div
          key={t.id}
          className="toast-in flex items-center gap-2.5 px-4 py-3 rounded-2xl"
          style={{
            background: t.kind === 'error' ? 'rgba(120,32,32,0.82)' : 'rgba(16,20,22,0.88)',
            backdropFilter: 'blur(16px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
            border: '0.5px solid rgba(255,255,255,0.18)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            maxWidth: 360,
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>
            {t.kind === 'success' ? '✓' : t.kind === 'error' ? '✕' : 'ⓘ'}
          </span>
          <p className="text-sm font-medium" style={{ color: '#fff' }}>{t.message}</p>
        </div>
      ))}
      <style>{`
        .toast-in { animation: toastIn 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.2) }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-14px) scale(0.96) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>
    </div>
  )
}
