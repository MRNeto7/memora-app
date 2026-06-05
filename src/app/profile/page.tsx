'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Stats { totalMemories: number; totalVenues: number; avgRating: number }
interface VenueOption { id: string; name: string; address: string | null }

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [memoraId, setMemoraId] = useState('')
  const [stats, setStats] = useState<Stats>({ totalMemories: 0, totalVenues: 0, avgRating: 0 })
  const [favouriteVenue, setFavouriteVenue] = useState<VenueOption | null>(null)
  const [venueOptions, setVenueOptions] = useState<VenueOption[]>([])
  const [showVenuePicker, setShowVenuePicker] = useState(false)
  const [wishlist, setWishlist] = useState<{ name: string; address: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  useEffect(() => { fetchProfile() }, [])

  async function fetchProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) setEmail(user.email)

    const { data: profile } = await supabase.from('users').select('display_name, memora_id, favourite_venue_id').eq('id', user.id).single()
    if (profile?.display_name) setDisplayName(profile.display_name)
    if (profile?.memora_id) setMemoraId(profile.memora_id)

    const { data: memories } = await supabase.from('memories').select('rating, venue:venues(id, name, address)')
    if (memories) {
      const rated = memories.filter((m: { rating: number | null }) => m.rating)
      const avg = rated.length > 0 ? rated.reduce((s: number, m: { rating: number }) => s + m.rating, 0) / rated.length : 0
      const uniqueVenues = new Map()
      memories.forEach((m: { venue?: { id: string; name: string; address: string | null } }) => {
        if (m.venue) uniqueVenues.set(m.venue.id, m.venue)
      })
      const venueList = Array.from(uniqueVenues.values()) as VenueOption[]
      setVenueOptions(venueList)
      setStats({ totalMemories: memories.length, totalVenues: uniqueVenues.size, avgRating: Math.round(avg * 10) / 10 })

      // Load saved favourite
      if (profile?.favourite_venue_id) {
        const fav = venueList.find(v => v.id === profile.favourite_venue_id)
        if (fav) setFavouriteVenue(fav)
      }
    }

    const { data: wish } = await supabase.from('wishlists').select('venue:venues(name, address)').limit(3)
    if (wish) setWishlist(wish.map((w: { venue: { name: string; address: string | null } }) => w.venue))
    setLoading(false)
  }

  async function selectFavourite(venue: VenueOption) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('users').update({ favourite_venue_id: venue.id }).eq('id', user.id)
    setFavouriteVenue(venue)
    setShowVenuePicker(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const initials = (displayName || email).slice(0, 2).toUpperCase()
  const displayLabel = displayName || email.split('@')[0]

  return (
    <div className="min-h-screen" style={{ background: '#EAE5DD', paddingBottom: 80 }}>
      {/* Hero header */}
      <div className="px-5 pt-12 pb-8" style={{ background: '#0D4F57' }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-semibold flex-shrink-0"
            style={{ background: '#C9A86A', color: '#fff', letterSpacing: 1 }}>
            {initials}
          </div>
          <div>
            <p className="font-semibold text-white text-base leading-tight">{displayLabel}</p>
            {memoraId && <p className="text-xs mt-0.5 font-mono tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>{memoraId}</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Memories', value: stats.totalMemories },
            { label: 'Places', value: stats.totalVenues },
            { label: 'Avg rating', value: stats.avgRating > 0 ? `${stats.avgRating}★` : '—' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <p className="text-xl font-semibold text-white">{loading ? '…' : s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">

        {/* Favourite place */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <p className="text-sm font-semibold" style={{ color: '#0D4F57' }}>Favourite place</p>
            <button onClick={() => setShowVenuePicker(!showVenuePicker)}
              className="text-xs px-3 py-1 rounded-lg" style={{ background: '#f5f2ed', color: '#7D878D' }}>
              {favouriteVenue ? 'Change' : 'Select'}
            </button>
          </div>

          {showVenuePicker && (
            <div className="px-4 pb-3">
              {venueOptions.length === 0 ? (
                <p className="text-xs" style={{ color: '#7D878D' }}>Save some memories first</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {venueOptions.map(v => (
                    <button key={v.id} onClick={() => selectFavourite(v)}
                      className="text-left px-3 py-2 rounded-xl text-sm transition-colors hover:bg-gray-50"
                      style={{ border: favouriteVenue?.id === v.id ? '1.5px solid #0D4F57' : '1px solid #f0ede8', color: '#0D4F57' }}>
                      <p className="font-medium text-sm">{v.name}</p>
                      {v.address && <p className="text-xs truncate" style={{ color: '#7D878D' }}>{v.address}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!showVenuePicker && (
            <div className="px-4 pb-4">
              {favouriteVenue ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f5f2ed' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#C9A86A"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#0D4F57' }}>{favouriteVenue.name}</p>
                    {favouriteVenue.address && <p className="text-xs" style={{ color: '#7D878D' }}>{favouriteVenue.address}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: '#7D878D' }}>Pick your favourite restaurant from your memories</p>
              )}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
          <p className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: '#7D878D' }}>Settings</p>

          <PrivacyToggles />

          <Link href="/settings" className="w-full flex items-center px-4 py-3.5 transition-colors hover:bg-gray-50 no-underline"
            style={{ borderTop: '0.5px solid rgba(13,79,87,0.06)' }}>
            <div className="flex-1">
              <p className="text-sm" style={{ color: '#0D4F57' }}>Account settings</p>
              <p className="text-xs mt-0.5" style={{ color: '#7D878D' }}>Name, password, notifications</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0babe" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
          </Link>

          <Link href="/legal/privacy" className="w-full flex items-center px-4 py-3.5 transition-colors hover:bg-gray-50 no-underline"
            style={{ borderTop: '0.5px solid rgba(13,79,87,0.06)' }}>
            <div className="flex-1">
              <p className="text-sm" style={{ color: '#0D4F57' }}>Privacy policy</p>
              <p className="text-xs mt-0.5" style={{ color: '#7D878D' }}>How we use your data</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0babe" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
          </Link>

          <Link href="/legal/terms" className="w-full flex items-center px-4 py-3.5 transition-colors hover:bg-gray-50 no-underline"
            style={{ borderTop: '0.5px solid rgba(13,79,87,0.06)' }}>
            <div className="flex-1">
              <p className="text-sm" style={{ color: '#0D4F57' }}>Terms of service</p>
              <p className="text-xs mt-0.5" style={{ color: '#7D878D' }}>Terms and conditions</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0babe" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
          </Link>
        </div>

        <button onClick={handleSignOut} className="w-full py-3 rounded-2xl text-sm font-medium"
          style={{ color: '#a32d2d', background: 'rgba(163,45,45,0.07)', border: '0.5px solid rgba(163,45,45,0.15)' }}>
          Sign out
        </button>
      </div>

      {/* Venue picker backdrop */}
      {showVenuePicker && (
        <div className="fixed inset-0 z-0" onClick={() => setShowVenuePicker(false)} />
      )}
    </div>
  )
}

function PrivacyToggleRow({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="w-full flex items-center px-4 py-3.5" style={{ borderTop: '0.5px solid rgba(13,79,87,0.06)' }}>
      <div className="flex-1">
        <p className="text-sm" style={{ color: '#0D4F57' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: '#7D878D' }}>{sub}</p>
      </div>
      <button onClick={() => onChange(!value)} style={{ width: 44, height: 26, borderRadius: 13, background: value ? '#0D4F57' : '#d4cdc3', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}

function PrivacyToggles() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [memoriesPublic, setMemoriesPublic] = React.useState(false)
  const [wishlistPublic, setWishlistPublic] = React.useState(false)
  const [userId, setUserId] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('users').select('profile_public, wishlist_public').eq('id', user.id).single()
      if (data) { setMemoriesPublic(data.profile_public ?? false); setWishlistPublic(data.wishlist_public ?? false) }
    }
    load()
  }, [])

  async function toggle(field: string, value: boolean) {
    if (!userId) return
    await supabase.from('users').update({ [field]: value }).eq('id', userId)
  }

  return (
    <>
      <PrivacyToggleRow label="Public memories" sub="Friends can see your public memories" value={memoriesPublic}
        onChange={v => { setMemoriesPublic(v); toggle('profile_public', v) }} />
      <PrivacyToggleRow label="Public wishlist" sub="Friends can see your wishlist" value={wishlistPublic}
        onChange={v => { setWishlistPublic(v); toggle('wishlist_public', v) }} />
    </>
  )
}
