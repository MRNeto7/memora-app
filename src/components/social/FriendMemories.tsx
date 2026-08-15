'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getThumbUrl } from '@/lib/storage'
import PlacePhoto from '@/components/ui/PlacePhoto'
import Portal from '@/components/ui/Portal'
import Lightbox from '@/components/media/Lightbox'
import { toast } from '@/lib/toast'
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
  const [viewing, setViewing] = useState<PublicMemory | null>(null)
  // Venues I've already been to (my memories) or already want (my wishlist) —
  // no point offering "Add to my wishlist" for those
  const [myVenueIds, setMyVenueIds] = useState<Set<string>>(new Set())

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

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const [{ data: mine }, { data: myWish }] = await Promise.all([
          supabase.from('memories').select('venue_id').eq('user_id', user.id),
          supabase.from('wishlists').select('venue_id').eq('user_id', user.id),
        ])
        setMyVenueIds(new Set([...(mine ?? []), ...(myWish ?? [])].map(r => r.venue_id).filter((v): v is string => Boolean(v))))
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
    if (error) toast('Could not add to wishlist', 'error')
    else {
      toast(`${venue.name} added to your wishlist`)
      setMyVenueIds(prev => new Set(prev).add(venue.id))
    }
    setAddingToWishlist(null)
  }

  const initials = (friend.display_name ?? friend.memora_id).slice(0, 2).toUpperCase()

  return (
    <div className="page-enter min-h-screen flex flex-col" style={{ background: 'var(--stone-400)', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'var(--stone-400)', borderBottom: '0.5px solid var(--stone-500)', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingBottom: 0 }}>
        <div className="px-5 mb-4 flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--stone-200)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16191B" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--stone-200)' }}>
            <span className="font-bold" style={{ color: 'var(--slate)' }}>{initials}</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold">{friend.display_name ?? friend.memora_id}</h1>
            <p className="text-xs" style={{ color: 'var(--slate)' }}>{friend.memora_id} · {friend.memory_count} public {friend.memory_count === 1 ? 'memory' : 'memories'}</p>
          </div>
        </div>

        <div className="flex px-5 gap-1">
          {(['memories', 'wishlist'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2.5 text-sm font-medium rounded-t-xl capitalize transition-all"
              style={{ background: tab === t ? 'var(--stone-200)' : 'transparent', color: tab === t ? 'var(--teal-600)' : 'var(--slate)' }}>
              {t === 'memories' ? `Memories (${memories.length})` : wishlistPublic ? `Wishlist (${wishlist.length})` : 'Wishlist'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 flex-1">
        {loading ? (
          <div className="flex justify-center py-20"><p className="text-sm" style={{ color: 'var(--slate)' }}>Loading…</p></div>
        ) : tab === 'memories' ? (
          memories.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="font-semibold" style={{ color: 'var(--teal-600)' }}>No public memories yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--slate)' }}>{friend.display_name ?? friend.memora_id} hasn&apos;t shared any memories</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {memories.map(mem => (
                <div key={mem.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(16,20,22,0.06)' }}>
                  <button onClick={() => setViewing(mem)} className="flex w-full text-left">
                    <div style={{ width: 76, height: 76, flexShrink: 0, margin: 6, borderRadius: 12, overflow: 'hidden', background: 'var(--stone-400)' }}>
                      {mem.memory_photos.length > 0
                        ? <SignedThumb storagePath={mem.memory_photos[0].storage_path} />
                        : <PlacePhoto placeId={mem.venue?.google_place_id ?? null} width={150} fallbackInitials={mem.venue?.name?.slice(0, 2).toUpperCase()} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      }
                    </div>
                    <div className="flex-1 px-3 py-3">
                      <div className="flex items-start justify-between mb-0.5">
                        <p className="font-semibold text-sm" style={{ color: 'var(--teal-600)' }}>{mem.venue?.name}</p>
                        {mem.rating && <span className="inline-flex items-center gap-1 text-xs font-semibold ml-2 flex-shrink-0" style={{ color: 'var(--gold-500)' }}><Icon name="star" size={11} color="var(--gold-500)" fill="#C9A86A" /> {mem.rating}</span>}
                      </div>
                      {mem.dish_name && <p className="text-xs italic mb-0.5" style={{ color: 'var(--slate)' }}>{mem.dish_name}</p>}
                      <p className="text-xs" style={{ color: 'var(--slate-light)' }}>{new Date(mem.visited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </button>
                  {mem.venue && !myVenueIds.has(mem.venue.id) && (
                    <button
                      onClick={() => addToMyWishlist(mem.venue)}
                      disabled={addingToWishlist === mem.venue.id}
                      className="w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={{ borderTop: '0.5px solid rgba(16,20,22,0.06)', color: 'var(--gold-500)', background: 'rgba(201,168,106,0.06)' }}>
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
              <p className="font-semibold" style={{ color: 'var(--teal-600)' }}>Wishlist is private</p>
              <p className="text-sm mt-1" style={{ color: 'var(--slate)' }}>{friend.display_name ?? friend.memora_id} hasn&apos;t made their wishlist public</p>
            </div>
          ) : wishlist.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="font-semibold" style={{ color: 'var(--teal-600)' }}>Empty wishlist</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {wishlist.map(item => (
                <div key={item.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(16,20,22,0.06)' }}>
                  <div className="flex">
                    <div style={{ width: 76, height: 76, flexShrink: 0, margin: 6, borderRadius: 12, overflow: 'hidden' }}>
                      <PlacePhoto placeId={item.venue?.google_place_id ?? null} width={150} fallbackInitials={item.venue?.name?.slice(0, 2).toUpperCase()} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div className="flex-1 px-3 py-3">
                      <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--teal-600)' }}>{item.venue?.name}</p>
                      {item.venue?.address && <p className="text-xs truncate mb-0.5" style={{ color: 'var(--slate)' }}>{item.venue.address}</p>}
                      {item.notes && <p className="text-xs italic" style={{ color: 'var(--slate)' }}>{item.notes}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {viewing && <FriendMemorySheet memory={viewing} friendName={friend.display_name ?? friend.memora_id} onClose={() => setViewing(null)} />}
    </div>
  )
}

// Read-only look at a friend's shared memory — photos open full-screen
function FriendMemorySheet({ memory, friendName, onClose }: { memory: PublicMemory; friendName: string; onClose: () => void }) {
  const [lightboxAt, setLightboxAt] = useState<number | null>(null)
  const date = new Date(memory.visited_at)

  return (
    <Portal>
      <div className="backdrop-enter fixed z-[80]" style={{ top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(16,20,22,0.4)', backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)' }} onClick={onClose} />
      <div className="fixed z-[90] flex items-start justify-center pointer-events-none" style={{ top: 0, left: 0, right: 0, bottom: 0, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        <div className="sheet-enter glass-modal relative w-full rounded-3xl overflow-hidden flex flex-col pointer-events-auto" style={{ maxHeight: '82vh', width: 'min(420px, 100%)' }}>

          <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '0.5px solid rgba(16,20,22,0.08)' }}>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--teal-600)' }}>{friendName}&apos;s memory</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(16,20,22,0.08)', color: 'var(--slate)', fontSize: 14 }}>✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <h3 className="text-lg font-semibold leading-tight mb-1" style={{ color: 'var(--teal-600)' }}>{memory.venue?.name ?? 'A memory'}</h3>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {memory.venue?.address && <p className="text-xs" style={{ color: 'var(--slate)' }}>{memory.venue.address}</p>}
              <span style={{ color: 'var(--stone-500)', fontSize: 10 }}>·</span>
              <p className="text-xs" style={{ color: 'var(--slate)' }}>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>

            {memory.memory_photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                {memory.memory_photos.map((p, i) => (
                  <button key={p.id} onClick={() => setLightboxAt(i)} className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 104, height: 104, background: 'var(--stone-400)' }}>
                    <SignedThumb storagePath={p.storage_path} />
                  </button>
                ))}
              </div>
            )}

            {memory.rating && (
              <div className="flex items-baseline gap-1.5 mb-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--stone-200)' }}>
                <Icon name="star" size={15} color="var(--gold-500)" fill="var(--gold-500)" style={{ alignSelf: 'center' }} />
                <span className="text-lg font-semibold" style={{ color: 'var(--teal-600)' }}>{memory.rating}</span>
                <span className="text-xs" style={{ color: 'var(--slate)' }}>/ 10</span>
              </div>
            )}

            {(memory.dish_name || memory.notes) && (
              <div className="px-3 py-2.5 rounded-xl" style={{ background: 'var(--stone-200)' }}>
                {memory.dish_name && <p className="text-sm font-semibold mb-1" style={{ color: 'var(--teal-600)' }}>{memory.dish_name}</p>}
                {memory.notes && <p className="text-sm leading-relaxed" style={{ color: 'var(--slate)' }}>{memory.notes}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxAt !== null && (
        <Lightbox photos={memory.memory_photos} initialIndex={lightboxAt} onClose={() => setLightboxAt(null)} />
      )}
    </Portal>
  )
}

function SignedThumb({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const supabase = createClient()
  useEffect(() => {
    getThumbUrl(supabase, storagePath).then(u => { if (u) setUrl(u) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storagePath])
  if (!url) return <div className="w-full h-full animate-pulse" style={{ background: 'var(--stone-400)' }} />
  return <img src={url} className="w-full h-full" style={{ objectFit: 'cover' }} />
}
