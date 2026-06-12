'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BottomNav() {
  const pathname = usePathname()
  const supabase = createClient()
  const [pendingRequests, setPendingRequests] = useState(0)

  // Re-checked on every navigation so the badge stays fresh without polling
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { count } = await supabase
        .from('friend_requests')
        .select('id', { count: 'exact', head: true })
        .eq('to_user_id', user.id)
        .eq('status', 'pending')
      if (!cancelled) setPendingRequests(count ?? 0)
    }
    load()
    return () => { cancelled = true }
  }, [pathname])

  const isActive = (href: string) => href === '/places' ? pathname.startsWith('/places') : pathname === href

  return (
    <nav
      className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      <div
        className="glass-pill flex items-end justify-around pointer-events-auto"
        style={{ borderRadius: 32, padding: '8px 10px 9px', width: 'min(420px, calc(100% - 24px))' }}
      >

        {/* LEFT: Places */}
        <NavItem href="/places" label="Places" active={isActive('/places')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/places') ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
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
        <div className="flex flex-col items-center -mt-7">
          <Link href="/" className="press" style={{ textDecoration: 'none' }}>
            <div className="flex flex-col items-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-1"
                style={{
                  background: isActive('/') ? '#C9A86A' : '#0D4F57',
                  boxShadow: isActive('/')
                    ? '0 6px 24px rgba(201,168,106,0.45)'
                    : '0 4px 20px rgba(13,79,87,0.35)',
                  border: '3px solid rgba(255,255,255,0.7)',
                  transition: 'background 0.3s ease, box-shadow 0.3s ease',
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
        <NavItem href="/social" label="Social" active={isActive('/social')} badge={pendingRequests}>
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

function NavItem({ href, label, active, badge = 0, children }: {
  href: string
  label: string
  active: boolean
  badge?: number
  children: React.ReactNode
}) {
  return (
    <Link href={href} className="press flex flex-col items-center gap-0.5" style={{ textDecoration: 'none', minWidth: 48, padding: '2px 0' }}>
      <div style={{
        position: 'relative',
        color: active ? '#0D4F57' : '#7D878D',
        transform: active ? 'translateY(-1px) scale(1.08)' : 'none',
        transition: 'transform 0.3s var(--spring), color 0.2s ease',
      }}>
        {badge > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -8, minWidth: 15, height: 15, padding: '0 4px',
            borderRadius: 8, background: '#C9A86A', color: '#fff', fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            boxShadow: '0 1px 4px rgba(201,168,106,0.5)',
          }}>{badge > 9 ? '9+' : badge}</span>
        )}
        {children}
      </div>
      <span style={{ fontSize: 10, color: active ? '#0D4F57' : '#7D878D', fontWeight: active ? 600 : 400, transition: 'color 0.2s ease' }}>{label}</span>
      <div style={{
        width: 4, height: 4, borderRadius: '50%', background: '#C9A86A', marginTop: 1,
        opacity: active ? 1 : 0, transform: active ? 'scale(1)' : 'scale(0)',
        transition: 'opacity 0.25s ease, transform 0.3s var(--spring)',
      }} />
    </Link>
  )
}
