'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/',
    label: 'Map',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
        <line x1="9" y1="3" x2="9" y2="18"/>
        <line x1="15" y1="6" x2="15" y2="21"/>
      </svg>
    ),
  },
  {
    href: '/capture',
    label: 'Capture',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    ),
    isCapture: true,
  },
  {
    href: '/memories',
    label: 'Memories',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-end"
      style={{
        background: 'rgba(234,229,221,0.96)',
        backdropFilter: 'blur(12px)',
        borderTop: '0.5px solid rgba(13,79,87,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center py-2 gap-0.5 transition-opacity"
            style={{ textDecoration: 'none' }}
          >
            {tab.isCapture ? (
              // Capture — elevated gold button
              <div className="flex flex-col items-center -mt-5">
                <div
                  className="flex items-center justify-center rounded-full mb-1"
                  style={{
                    width: 52,
                    height: 52,
                    background: active ? '#0D4F57' : '#C9A86A',
                    boxShadow: '0 4px 16px rgba(201,168,106,0.4)',
                  }}
                >
                  <div style={{ color: '#fff' }}>{tab.icon(active)}</div>
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: active ? '#0D4F57' : '#7D878D', fontSize: 10 }}
                >
                  {tab.label}
                </span>
              </div>
            ) : (
              <>
                <div style={{ color: active ? '#0D4F57' : '#7D878D' }}>{tab.icon(active)}</div>
                <span
                  className="text-xs"
                  style={{
                    color: active ? '#0D4F57' : '#7D878D',
                    fontWeight: active ? 600 : 400,
                    fontSize: 10,
                  }}
                >
                  {tab.label}
                </span>
                {active && (
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#C9A86A', marginTop: 1 }} />
                )}
              </>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
