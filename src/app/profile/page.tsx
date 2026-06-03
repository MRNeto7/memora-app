'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Stats {
  totalMemories: number
  totalVenues: number
  avgRating: number
  topVenue: string | null
}

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [stats, setStats] = useState<Stats>({ totalMemories: 0, totalVenues: 0, avgRating: 0, topVenue: null })
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) setEmail(user.email)

    const { data: memories } = await supabase
      .from('memories')
      .select('*, venue:venues(name)')

    if (memories) {
      const rated = memories.filter((m: { rating: number | null }) => m.rating)
      const avgRating = rated.length > 0
        ? rated.reduce((sum: number, m: { rating: number }) => sum + m.rating, 0) / rated.length
        : 0

      const venueCount: Record<string, number> = {}
      memories.forEach((m: { venue?: { name: string } }) => {
        if (m.venue?.name) venueCount[m.venue.name] = (venueCount[m.venue.name] ?? 0) + 1
      })
      const topVenue = Object.entries(venueCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      const uniqueVenues = new Set(memories.map((m: { venue_id: string }) => m.venue_id)).size

      setStats({ totalMemories: memories.length, totalVenues: uniqueVenues, avgRating, topVenue })
    }
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const initials = email.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen" style={{ background: 'var(--stone)', paddingBottom: 80 }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-8" style={{ background: '#0D4F57' }}>
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ background: '#C9A86A', color: '#fff' }}
          >
            {initials}
          </div>
          <div>
            <p className="font-semibold text-white text-base">{email || 'Your profile'}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Memora member</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4">
        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Memories', value: stats.totalMemories, icon: '📍' },
            { label: 'Places visited', value: stats.totalVenues, icon: '🏛️' },
            { label: 'Avg rating', value: stats.avgRating ? stats.avgRating.toFixed(1) : '—', icon: '⭐' },
            { label: 'Favourite spot', value: stats.topVenue ?? '—', icon: '❤️', small: true },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-4"
              style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.1)' }}
            >
              <span style={{ fontSize: 20 }}>{stat.icon}</span>
              <p
                className="font-semibold mt-1 truncate"
                style={{ color: '#0D4F57', fontSize: stat.small ? 13 : 22 }}
              >
                {loading ? '…' : stat.value}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#7D878D' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Settings section */}
        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.1)' }}
        >
          <p className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#7D878D' }}>Account</p>

          {[
            { label: 'Edit profile', icon: '✏️', action: () => {} },
            { label: 'Notification settings', icon: '🔔', action: () => {} },
            { label: 'Privacy settings', icon: '🔒', action: () => {} },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full flex items-center px-4 py-3.5 transition-colors hover:bg-gray-50"
              style={{ borderTop: '0.5px solid rgba(13,79,87,0.06)' }}
            >
              <span className="mr-3" style={{ fontSize: 16 }}>{item.icon}</span>
              <span className="text-sm flex-1 text-left" style={{ color: '#0D4F57' }}>{item.label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0babe" strokeWidth="1.5">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          ))}
        </div>

        {/* Coming soon */}
        <div
          className="rounded-2xl p-4 mb-4"
          style={{ background: 'rgba(201,168,106,0.12)', border: '0.5px solid rgba(201,168,106,0.3)' }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: '#C9A86A' }}>Coming soon</p>
          <p className="text-xs leading-relaxed" style={{ color: '#7D878D' }}>
            Share your public map, follow friends, and see who else has eaten at your favourite spots.
          </p>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full py-3 rounded-2xl text-sm font-medium"
          style={{ background: 'rgba(163,45,45,0.08)', color: '#a32d2d', border: '0.5px solid rgba(163,45,45,0.15)' }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
