'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Stats { totalMemories: number; totalVenues: number; avgRating: number; topVenue: string | null }
interface FavouriteVenue { id: string; name: string; address: string | null; count: number }

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [stats, setStats] = useState<Stats>({ totalMemories: 0, totalVenues: 0, avgRating: 0, topVenue: null })
  const [favourites, setFavourites] = useState<FavouriteVenue[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  useEffect(() => { fetchProfile() }, [])

  async function fetchProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) setEmail(user.email)

    const { data: memories } = await supabase.from('memories').select('*, venue:venues(id, name, address)')
    const { data: wishlist } = await supabase.from('wishlists').select('*, venue:venues(id, name, address)')

    if (memories) {
      const rated = memories.filter((m: { rating: number | null }) => m.rating)
      const avg = rated.length > 0 ? rated.reduce((s: number, m: { rating: number }) => s + m.rating, 0) / rated.length : 0
      const venueCount: Record<string, { name: string; address: string | null; count: number }> = {}
      memories.forEach((m: { venue?: { id: string; name: string; address: string | null } }) => {
        if (m.venue) {
          if (!venueCount[m.venue.id]) venueCount[m.venue.id] = { name: m.venue.name, address: m.venue.address, count: 0 }
          venueCount[m.venue.id].count++
        }
      })
      const top = Object.entries(venueCount).sort((a, b) => b[1].count - a[1].count)[0]
      setStats({ totalMemories: memories.length, totalVenues: Object.keys(venueCount).length, avgRating: Math.round(avg * 10) / 10, topVenue: top?.[1].name ?? null })
    }

    if (wishlist) {
      setFavourites(wishlist.map((w: { venue: { id: string; name: string; address: string | null } }) => ({
        id: w.venue.id, name: w.venue.name, address: w.venue.address, count: 0
      })))
    }
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const initials = email.slice(0, 2).toUpperCase()
  const displayName = email.split('@')[0]

  return (
    <div className="min-h-screen" style={{ background: '#EAE5DD', paddingBottom: 80 }}>

      {/* Hero header */}
      <div className="px-5 pt-12 pb-10" style={{ background: '#0D4F57' }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-semibold flex-shrink-0"
            style={{ background: '#C9A86A', color: '#fff', letterSpacing: 1 }}>
            {initials}
          </div>
          <div>
            <p className="font-semibold text-white text-base leading-tight">{displayName}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{email}</p>
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Memories', value: stats.totalMemories },
            { label: 'Places', value: stats.totalVenues },
            { label: 'Avg rating', value: stats.avgRating > 0 ? `${stats.avgRating}★` : '—' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <p className="text-xl font-semibold text-white">{loading ? '…' : s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 -mt-4">

        {/* Favourite spot */}
        {stats.topVenue && (
          <div className="rounded-2xl p-4 mb-4 flex items-center gap-3" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f5f2ed' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#C9A86A"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#7D878D' }}>Most visited</p>
              <p className="text-sm font-semibold" style={{ color: '#0D4F57' }}>{stats.topVenue}</p>
            </div>
          </div>
        )}

        {/* Wishlist */}
        <div className="rounded-2xl overflow-hidden mb-4" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <p className="text-sm font-semibold" style={{ color: '#0D4F57' }}>Wishlist</p>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f5f2ed', color: '#7D878D' }}>{favourites.length}</span>
          </div>
          {favourites.length === 0 ? (
            <div className="px-4 pb-4">
              <p className="text-sm" style={{ color: '#7D878D' }}>Add restaurants to your wishlist from the Places tab.</p>
            </div>
          ) : (
            favourites.map((venue) => (
              <div key={venue.id} className="flex items-center px-4 py-3" style={{ borderTop: '0.5px solid rgba(13,79,87,0.06)' }}>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: '#0D4F57' }}>{venue.name}</p>
                  {venue.address && <p className="text-xs mt-0.5 truncate" style={{ color: '#7D878D' }}>{venue.address}</p>}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#C9A86A"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
            ))
          )}
        </div>

        {/* Settings */}
        <div className="rounded-2xl overflow-hidden mb-4" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
          <p className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: '#7D878D' }}>Settings</p>
          {[
            { label: 'Edit profile', sub: 'Name and avatar' },
            { label: 'Notifications', sub: 'On this day reminders' },
            { label: 'Privacy', sub: 'Public map and data' },
          ].map((item) => (
            <button key={item.label} className="w-full flex items-center px-4 py-3.5 transition-colors hover:bg-gray-50"
              style={{ borderTop: '0.5px solid rgba(13,79,87,0.06)' }}>
              <div className="flex-1 text-left">
                <p className="text-sm" style={{ color: '#0D4F57' }}>{item.label}</p>
                <p className="text-xs mt-0.5" style={{ color: '#7D878D' }}>{item.sub}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0babe" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </div>

        {/* Coming soon */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(201,168,106,0.1)', border: '0.5px solid rgba(201,168,106,0.25)' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: '#C9A86A' }}>Social coming soon</p>
          <p className="text-xs leading-relaxed" style={{ color: '#7D878D' }}>Share your map, follow friends, and discover where people you trust have eaten.</p>
        </div>

        <button onClick={handleSignOut} className="w-full py-3 rounded-2xl text-sm font-medium"
          style={{ color: '#a32d2d', background: 'rgba(163,45,45,0.07)', border: '0.5px solid rgba(163,45,45,0.15)' }}>
          Sign out
        </button>
      </div>
    </div>
  )
}
