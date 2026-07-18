'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useNotifications } from '@/lib/notifications'
import { useIsPro, FREE_MEMORY_LIMIT, FREE_PHOTOS_PER_MEMORY } from '@/lib/pro'
import NotificationCenter from '@/components/notifications/NotificationCenter'
import ProUpsell from '@/components/pro/ProUpsell'
import Icon from '@/components/ui/Icon'
import Portal from '@/components/ui/Portal'

interface Stats { totalMemories: number; totalVenues: number; avgRating: number }
interface VenueOption { id: string; name: string; address: string | null }

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mimoraId, setMimoraId] = useState('')
  const [stats, setStats] = useState<Stats>({ totalMemories: 0, totalVenues: 0, avgRating: 0 })
  const [favouriteVenue, setFavouriteVenue] = useState<VenueOption | null>(null)
  const [venueOptions, setVenueOptions] = useState<VenueOption[]>([])
  const [showVenuePicker, setShowVenuePicker] = useState(false)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProInfo, setShowProInfo] = useState(false)
  const isPro = useIsPro()
  const { items: notifications, loading: notifLoading, unreadCount, reload: reloadNotifications, markAllSeen } = useNotifications()
  const router = useRouter()
  const supabase = createClient()

  function openNotifications() {
    setShowNotifications(true)
    markAllSeen()
  }

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); router.push('/auth'); return }
    if (user.email) setEmail(user.email)

    const { data: profile, error: profileError } = await supabase.from('users').select('display_name, memora_id, favourite_venue_id').eq('id', user.id).maybeSingle()
    if (profile?.display_name) setDisplayName(profile.display_name)
    if (profile?.memora_id) setMimoraId(profile.memora_id)

    const { data: memories, error: memError } = await supabase.from('memories').select('rating, venue:venues(id, name, address)')
    if (profileError || memError) setLoadError(true)
    if (memories) {
      const rated = memories.filter(m => m.rating != null)
      const avg = rated.length > 0 ? rated.reduce((s, m) => s + (m.rating ?? 0), 0) / rated.length : 0
      const uniqueVenues = new Map<string, VenueOption>()
      memories.forEach(m => {
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


    setLoading(false)
  }

  function retryFetch() {
    setLoading(true)
    setLoadError(false)
    fetchProfile()
  }

  useEffect(() => {
    const load = async () => { await fetchProfile() }
    load()
  }, [])

  async function selectFavourite(venue: VenueOption) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('users').update({ favourite_venue_id: venue.id }).eq('id', user.id)
    if (error) {
      console.error('Failed to save favourite:', error.message)
      // Column may not exist — show it locally anyway
    }
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
    <div className="page-enter min-h-screen" style={{ background: 'var(--stone-400)', paddingBottom: 'calc(120px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {/* Hero header */}
      <div className="page-header px-5 pb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-semibold flex-shrink-0"
            style={{ background: 'var(--gold-500)', color: '#fff', letterSpacing: 1 }}>
            {initials}
          </div>
          <div>
            <p className="font-semibold text-base leading-tight">{displayLabel}</p>
            {mimoraId && <p className="text-xs mt-0.5 font-mono tracking-widest" style={{ color: 'var(--slate)' }}>{mimoraId}</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Memories', value: stats.totalMemories },
            { label: 'Places', value: stats.totalVenues },
            { label: 'Avg rating', value: stats.avgRating > 0 ? `${stats.avgRating}★` : '—' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--stone-200)' }}>
              <p className="text-xl font-semibold">{loading ? '…' : s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--slate)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">

        {loadError && (
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
            style={{ background: 'rgba(163,45,45,0.08)', border: '0.5px solid rgba(163,45,45,0.2)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>Couldn&apos;t load your profile. Check your connection.</p>
            <button onClick={retryFetch} className="text-xs font-semibold px-3 py-1.5 rounded-xl flex-shrink-0"
              style={{ background: 'var(--danger)', color: '#fff' }}>
              Retry
            </button>
          </div>
        )}

        {/* Favourite place */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(16,20,22,0.06)' }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--teal-600)' }}>Favourite place</p>
            <button onClick={() => setShowVenuePicker(!showVenuePicker)}
              className="text-xs px-3 py-1 rounded-lg" style={{ background: 'var(--stone-200)', color: 'var(--slate)' }}>
              {favouriteVenue ? 'Change' : 'Select'}
            </button>
          </div>

          {showVenuePicker && (
            <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()}>
              {venueOptions.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--slate)' }}>Save some memories first</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {venueOptions.map(v => (
                    <button key={v.id}
                      onClick={(e) => { e.stopPropagation(); selectFavourite(v) }}
                      className="text-left px-3 py-2 rounded-xl text-sm transition-colors hover:bg-gray-50"
                      style={{ border: favouriteVenue?.id === v.id ? '1.5px solid var(--teal-600)' : '1px solid var(--stone-300)', color: 'var(--teal-600)', width: '100%' }}>
                      <p className="font-medium text-sm">{v.name}</p>
                      {v.address && <p className="text-xs truncate" style={{ color: 'var(--slate)' }}>{v.address}</p>}
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
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--stone-200)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#C9A86A"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--teal-600)' }}>{favouriteVenue.name}</p>
                    {favouriteVenue.address && <p className="text-xs" style={{ color: 'var(--slate)' }}>{favouriteVenue.address}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--slate)' }}>Pick your favourite restaurant from your memories</p>
              )}
            </div>
          )}
        </div>

        {/* Plan */}
        <PlanCard isPro={isPro} onLearnMore={() => setShowProInfo(true)} />

        {/* Notifications */}
        <button onClick={openNotifications}
          className="w-full rounded-2xl overflow-hidden flex items-center px-4 py-3.5"
          style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(16,20,22,0.06)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mr-3" style={{ background: 'var(--stone-200)' }}><Icon name="bell" size={16} color="var(--teal-600)" /></div>
          <div className="flex-1 text-left">
            <p className="text-sm" style={{ color: 'var(--teal-600)' }}>Notifications</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--slate)' }}>
              {unreadCount > 0 ? `${unreadCount} new` : 'Friend requests & throwbacks'}
            </p>
          </div>
          {unreadCount > 0 && (
            <span className="flex items-center justify-center mr-2" style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: 'var(--gold-500)', color: '#fff', fontSize: 11, fontWeight: 700 }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0babe" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
        </button>

        {/* Settings */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(16,20,22,0.06)' }}>
          <p className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--slate)' }}>Settings</p>

          <PrivacyToggles />

          <Link href="/bulk-upload" className="w-full flex items-center px-4 py-3.5 transition-colors hover:bg-gray-50 no-underline"
            style={{ borderTop: '0.5px solid rgba(16,20,22,0.06)' }}>
            <div className="flex-1">
              <p className="text-sm" style={{ color: 'var(--teal-600)' }}>Bulk upload</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--slate)' }}>Import multiple photos from camera roll</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0babe" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
          </Link>

          <Link href="/settings" className="w-full flex items-center px-4 py-3.5 transition-colors hover:bg-gray-50 no-underline"
            style={{ borderTop: '0.5px solid rgba(16,20,22,0.06)' }}>
            <div className="flex-1">
              <p className="text-sm" style={{ color: 'var(--teal-600)' }}>Account settings</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--slate)' }}>Name, password, notifications</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0babe" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
          </Link>

          <Link href="/legal/privacy" className="w-full flex items-center px-4 py-3.5 transition-colors hover:bg-gray-50 no-underline"
            style={{ borderTop: '0.5px solid rgba(16,20,22,0.06)' }}>
            <div className="flex-1">
              <p className="text-sm" style={{ color: 'var(--teal-600)' }}>Privacy policy</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--slate)' }}>How we use your data</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0babe" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
          </Link>

          <Link href="/legal/terms" className="w-full flex items-center px-4 py-3.5 transition-colors hover:bg-gray-50 no-underline"
            style={{ borderTop: '0.5px solid rgba(16,20,22,0.06)' }}>
            <div className="flex-1">
              <p className="text-sm" style={{ color: 'var(--teal-600)' }}>Terms of service</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--slate)' }}>Terms and conditions</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0babe" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
          </Link>
        </div>

        <button onClick={handleSignOut} className="w-full py-3 rounded-2xl text-sm font-medium"
          style={{ color: 'var(--danger)', background: 'rgba(163,45,45,0.07)', border: '0.5px solid rgba(163,45,45,0.15)' }}>
          Sign out
        </button>
      </div>

      {showNotifications && (
        <NotificationCenter
          items={notifications}
          loading={notifLoading}
          onClose={() => setShowNotifications(false)}
          onChanged={reloadNotifications}
        />
      )}

      {showProInfo && (
        <Portal>
          <div className="backdrop-enter fixed z-[60]" style={{ top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(16,20,22,0.4)', backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)' }} onClick={() => setShowProInfo(false)} />
          <div className="fixed z-[70] flex items-center justify-center pointer-events-none" style={{ top: 0, left: 0, right: 0, bottom: 0, padding: '16px' }}>
            <div className="sheet-enter pointer-events-auto" style={{ width: 'min(420px, 100%)' }}>
              <ProUpsell />
              <button onClick={() => setShowProInfo(false)} className="w-full mt-3 py-3 rounded-2xl text-sm font-medium" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', color: 'var(--teal-600)' }}>
                Close
              </button>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}

// Free vs Pro plan card — makes the free-tier limits explicit
function PlanCard({ isPro, onLearnMore }: { isPro: boolean | null; onLearnMore: () => void }) {
  if (isPro === null) return null

  if (isPro) {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, var(--teal-500) 0%, var(--teal-600) 100%)', boxShadow: '0 4px 16px rgba(16,20,22,0.2)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(201,168,106,0.2)', border: '0.5px solid rgba(201,168,106,0.4)' }}>
          <Icon name="sparkle" size={20} color="var(--gold-500)" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Mimora Pro</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>All features unlocked</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(201,168,106,0.25)', color: 'var(--gold-500)' }}>Active</span>
      </div>
    )
  }

  const limits = [
    `Up to ${FREE_MEMORY_LIMIT} memories`,
    `${FREE_PHOTOS_PER_MEMORY} photos per memory`,
    'Photos only — video is Pro',
    'Bulk upload is Pro',
  ]
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(16,20,22,0.06)' }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--slate)' }}>Free plan</p>
        <button onClick={onLearnMore} className="press text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'var(--teal-600)', color: 'var(--gold-500)' }}>
          See Mimora Pro
        </button>
      </div>
      <div className="px-4 pb-4">
        {limits.map(l => (
          <div key={l} className="flex items-center gap-2.5 py-1">
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gold-500)', flexShrink: 0 }} />
            <p className="text-xs" style={{ color: 'var(--slate)' }}>{l}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PrivacyToggleRow({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="w-full flex items-center px-4 py-3.5" style={{ borderTop: '0.5px solid rgba(16,20,22,0.06)' }}>
      <div className="flex-1">
        <p className="text-sm" style={{ color: 'var(--teal-600)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--slate)' }}>{sub}</p>
      </div>
      <button onClick={() => onChange(!value)} style={{ width: 44, height: 26, borderRadius: 13, background: value ? 'var(--teal-600)' : 'var(--stone-500)', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}

function PrivacyToggles() {
  const supabase = createClient()
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

  async function toggle(field: 'profile_public' | 'wishlist_public', value: boolean) {
    if (!userId) return
    const patch = field === 'profile_public' ? { profile_public: value } : { wishlist_public: value }
    await supabase.from('users').update(patch).eq('id', userId)
  }

  return (
    <>
      <PrivacyToggleRow label="Share memories with friends" sub="Only friends you’ve added can see memories you mark as shared" value={memoriesPublic}
        onChange={v => { setMemoriesPublic(v); toggle('profile_public', v) }} />
      <PrivacyToggleRow label="Share wishlist with friends" sub="Only friends you’ve added can see your wishlist" value={wishlistPublic}
        onChange={v => { setWishlistPublic(v); toggle('wishlist_public', v) }} />
    </>
  )
}
