'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSignedPhotoUrl } from '@/lib/storage'
import PlacePhoto from '@/components/ui/PlacePhoto'
import Icon from '@/components/ui/Icon'

interface FriendProfile {
  friend_id: string
  memora_id: string
  display_name: string | null
  memory_count: number
}

interface PublicMemory {
  id: string
  dish_name: string | null
  notes: string | null
  rating: number | null
  visited_at: string
  // Only the ~1km fuzzed coords are fetched for another user's memories — never the exact venue location
  public_lat: number | null
  public_lng: number | null
  venue: { id: string; name: string; address: string | null; google_place_id: string | null } | null
  memory_photos: { id: string; storage_path: string }[]
}

interface WishlistItem {
  id: string
  notes: string | null
  priority: number
  venue: { id: string; name: string; address: string | null; google_place_id: string | null }
}

export default function FriendMemories({ friend, onBack }: { friend: FriendProfile; onBack: () => void }) {
  const supabase = createClient()
  const [tab, setTab] = useState<'memories' | 'wishlist'>('memories')
  const [memories, setMemories] = useState<PublicMemory[]>([])
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [wishlistPublic, setWishlistPublic] = useState(false)
  const [addingToWishlist, setAddingToWishlist] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: profile } = await supabase.from('users').select('wishlist_public').eq('id', friend.friend_id).single()
      setWishlistPublic(profile?.wishlist_public ?? false)

      const { data: mems } = await supabase
        .from('memories')
        .select('id, dish_name, notes, rating, visited_at, public_lat, public_lng, venue:venues(id, name, address, google_place_id), memory_photos(id, storage_path)')
        .eq('user_id', friend.friend_id)
        .eq('is_public', true)
        .order('visited_at', { ascending: false })
      if (mems) setMemories(mems)

      if (profile?.wishlist_public) {
        const { data: wish } = await supabase
          .from('wishlists')
          .select('id, notes, priority, venue:venues(id, name, address, google_place_id)')
          .eq('user_id', friend.friend_id)
        if (wish) setWishlist(wish)
      }
      setLoading(false)
    }
    load()
  }, [friend.friend_id])

  async function addToMyWishlist(venue: PublicMemory['venue']) {
    if (!venue) return
    setAddingToWishlist(venue.id)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAddingToWishlist(null); return }

    // The venue row already exists — it came from the venues join
    const { error } = await supabase.from('wishlists').insert({ user_id: user.id, venue_id: venue.id, priority: 2 })
    if (!error) alert(`${venue.name} added to your wishlist!`)
    setAddingToWishlist(null)
  }

  const initials = (friend.display_name ?? friend.memora_id).slice(0, 2).toUpperCase()

  return (
    <div className="page-enter min-h-screen flex flex-col" style={{ background: '#EAE5DD', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: '#0D4F57', paddingTop: 48, paddingBottom: 0 }}>
        <div className="px-5 mb-4 flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#C9A86A' }}>
            <span className="text-white font-bold">{initials}</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">{friend.display_name ?? friend.memora_id}</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{friend.memora_id} · {friend.memory_count} public {friend.memory_count === 1 ? 'memory' : 'memories'}</p>
          </div>
        </div>

        <div className="flex px-5 gap-1">
          {(['memories', 'wishlist'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2.5 text-sm font-medium rounded-t-xl capitalize transition-all"
              style={{ background: tab === t ? '#EAE5DD' : 'transparent', color: tab === t ? '#0D4F57' : 'rgba(255,255,255,0.6)' }}>
              {t === 'memories' ? `Memories (${memories.length})` : wishlistPublic ? `Wishlist (${wishlist.length})` : 'Wishlist'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 flex-1">
        {loading ? (
          <div className="flex justify-center py-20"><p className="text-sm" style={{ color: '#7D878D' }}>Loading…</p></div>
        ) : tab === 'memories' ? (
          memories.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="font-semibold" style={{ color: '#0D4F57' }}>No public memories yet</p>
              <p className="text-sm mt-1" style={{ color: '#7D878D' }}>{friend.display_name ?? friend.memora_id} hasn&apos;t shared any memories</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {memories.map(mem => (
                <div key={mem.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(13,79,87,0.06)' }}>
                  <div className="flex">
                    <div style={{ width: 76, height: 76, flexShrink: 0, margin: 6, borderRadius: 12, overflow: 'hidden', background: '#EAE5DD' }}>
                      {mem.memory_photos.length > 0
                        ? <SignedThumb storagePath={mem.memory_photos[0].storage_path} />
                        : <PlacePhoto placeId={mem.venue?.google_place_id ?? null} width={150} fallbackInitials={mem.venue?.name?.slice(0, 2).toUpperCase()} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      }
                    </div>
                    <div className="flex-1 px-3 py-3">
                      <div className="flex items-start justify-between mb-0.5">
                        <p className="font-semibold text-sm" style={{ color: '#0D4F57' }}>{mem.venue?.name}</p>
                        {mem.rating && <span className="inline-flex items-center gap-1 text-xs font-semibold ml-2 flex-shrink-0" style={{ color: '#C9A86A' }}><Icon name="star" size={11} color="#C9A86A" fill="#C9A86A" /> {mem.rating}</span>}
                      </div>
                      {mem.dish_name && <p className="text-xs italic mb-0.5" style={{ color: '#7D878D' }}>{mem.dish_name}</p>}
                      <p className="text-xs" style={{ color: '#b0babe' }}>{new Date(mem.visited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  {mem.venue && (
                    <button
                      onClick={() => addToMyWishlist(mem.venue)}
                      disabled={addingToWishlist === mem.venue.id}
                      className="w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={{ borderTop: '0.5px solid rgba(13,79,87,0.06)', color: '#C9A86A', background: 'rgba(201,168,106,0.06)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                      {addingToWishlist === mem.venue.id ? 'Adding…' : 'Add to my wishlist'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          !wishlistPublic ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="font-semibold" style={{ color: '#0D4F57' }}>Wishlist is private</p>
              <p className="text-sm mt-1" style={{ color: '#7D878D' }}>{friend.display_name ?? friend.memora_id} hasn&apos;t made their wishlist public</p>
            </div>
          ) : wishlist.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="font-semibold" style={{ color: '#0D4F57' }}>Empty wishlist</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {wishlist.map(item => (
                <div key={item.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(13,79,87,0.06)' }}>
                  <div className="flex">
                    <div style={{ width: 76, height: 76, flexShrink: 0, margin: 6, borderRadius: 12, overflow: 'hidden' }}>
                      <PlacePhoto placeId={item.venue?.google_place_id ?? null} width={150} fallbackInitials={item.venue?.name?.slice(0, 2).toUpperCase()} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div className="flex-1 px-3 py-3">
                      <p className="font-semibold text-sm mb-0.5" style={{ color: '#0D4F57' }}>{item.venue?.name}</p>
                      {item.venue?.address && <p className="text-xs truncate mb-0.5" style={{ color: '#7D878D' }}>{item.venue.address}</p>}
                      {item.notes && <p className="text-xs italic" style={{ color: '#7D878D' }}>{item.notes}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

function SignedThumb({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const supabase = createClient()
  useEffect(() => {
    getSignedPhotoUrl(supabase, storagePath).then(u => { if (u) setUrl(u) })
  }, [storagePath])
  if (!url) return <div className="w-full h-full animate-pulse" style={{ background: '#EAE5DD' }} />
  return <img src={url} className="w-full h-full" style={{ objectFit: 'cover' }} />
}
