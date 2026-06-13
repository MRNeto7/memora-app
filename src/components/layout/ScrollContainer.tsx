'use client'

import { usePathname } from 'next/navigation'

// The body is pinned (see globals.css); all page scrolling happens here in a
// dedicated full-screen container — the reliable iOS WebView scrolling pattern.
// On the map route the container is click-through (pointer-events: none) so the
// persistent map behind it stays pannable.
export default function ScrollContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMap = pathname === '/'

  return (
    <div
      id="scroll-root"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflowY: isMap ? 'hidden' : 'auto',
        WebkitOverflowScrolling: 'touch',
        pointerEvents: isMap ? 'none' : 'auto',
      }}
    >
      {children}
    </div>
  )
}
