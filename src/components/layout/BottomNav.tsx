'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(234,229,221,0.96)',
        backdropFilter: 'blur(12px)',
        borderTop: '0.5px solid rgba(13,79,87,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-end justify-around px-2 pt-2 pb-3 relative">

        {/* LEFT: Memories */}
        <NavItem href="/memories" label="Memories" active={isActive('/memories')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/memories') ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </NavItem>

        {/* LEFT-CENTER: Capture */}
        <NavItem href="/capture" label="Capture" active={isActive('/capture')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/capture') ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </NavItem>

        {/* CENTER: Map — elevated */}
        <div className="flex flex-col items-center -mt-6">
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div
              className="flex flex-col items-center"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-1"
                style={{
                  background: isActive('/') ? '#C9A86A' : '#0D4F57',
                  boxShadow: '0 4px 20px rgba(13,79,87,0.3)',
                  border: '3px solid rgba(234,229,221,0.96)',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                  <line x1="9" y1="3" x2="9" y2="18"/>
                  <line x1="15" y1="6" x2="15" y2="21"/>
                </svg>
              </div>
              <span className="text-xs font-medium" style={{ color: isActive('/') ? '#C9A86A' : '#0D4F57', fontSize: 10 }}>
                Map
              </span>
            </div>
          </Link>
        </div>

        {/* RIGHT-CENTER: Social */}
        <NavItem href="/social" label="Social" active={isActive('/social')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/social') ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </NavItem>

        {/* RIGHT: Profile */}
        <NavItem href="/profile" label="Profile" active={isActive('/profile')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/profile') ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </NavItem>

      </div>
    </nav>
  )
}

function NavItem({ href, label, active, children }: {
  href: string
  label: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-0.5" style={{ textDecoration: 'none', minWidth: 48 }}>
      <div style={{ color: active ? '#0D4F57' : '#7D878D' }}>{children}</div>
      <span style={{ fontSize: 10, color: active ? '#0D4F57' : '#7D878D', fontWeight: active ? 600 : 400 }}>{label}</span>
      {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#C9A86A', marginTop: 1 }} />}
    </Link>
  )
}
