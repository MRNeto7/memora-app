'use client'

import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { createClient } from '@/lib/supabase/client'
import { getSignedPhotoUrls, thumbPath } from '@/lib/storage'
import { loadCached, saveCached, CACHE_KEYS } from '@/lib/offlineData'
import { MemoryWithDetails } from '@/lib/types/database'
import { useNotifications, NotificationItem } from '@/lib/notifications'
import Icon from '@/components/ui/Icon'
import MemorySheet from '@/components/memory/MemorySheet'
import WishlistSheet from '@/components/wishlist/WishlistSheet'
import MemoryPin from '@/components/map/MemoryPin'
import AddMemoryButton from '@/components/memory/AddMemoryButton'

interface WishlistVenue {
  wishlistId: string
  wishlistNotes: string | null
  wishlistPriority: number
  wishlistAddedAt: string
  id: string; name: string; lat: number; lng: number; address: string | null; google_place_id: string | null
}

const DEFAULT_CENTER = { lat: 51.505, lng: -0.09 }

// The map lives here, mounted once at the layout level, instead of inside the
// '/' route. Navigating between tabs only toggles visibility — the underlying
// google.maps.Map instance is never re-created, so each tab visit doesn't
// trigger a billed Maps load. Data is refetched on return without remounting.
export default function PersistentMapShell() {
  const pathname = usePathname()
  const visible = pathname === '/'
  const onAuth = pathname.startsWith('/auth')

  const [memories, setMemories] = useState<MemoryWithDetails[]>([])
  const [selected, setSelected] = useState<MemoryWithDetails | null>(null)
  const [selectedWishlist, setSelectedWishlist] = useState<WishlistVenue | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const supabase = createClient()

  const [wishlist, setWishlist] = useState<WishlistVenue[]>([])
  const [showMemories, setShowMemories] = useState(true)
  const [showWishlist, setShowWishlist] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const router = useRouter()
  const { items: notifications } = useNotifications()
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set())

  // The banner surfaces the top notification — a friend request first, then a
  // memory anniversary. Dismissals are per-session.
  const bannerItem = [
    ...notifications.filter(n => n.kind === 'friend_request'),
    ...notifications.filter(n => n.kind === 'anniversary'),
  ].find(n => !dismissedBanners.has(n.id))

  function dismissBanner(id: string) {
    setDismissedBanners(prev => new Set(prev).add(id))
  }

  function openBanner(item: NotificationItem) {
    if (item.kind === 'friend_request') {
      router.push('/social')
    } else if (item.kind === 'anniversary') {
      const mem = memories.find(m => m.id === item.memoryId)
      if (mem) { setSelected(mem); setShowAddSheet(false) }
      else { router.push('/memories') }
    }
    dismissBanner(item.id)
  }

  async function fetchWishlist() {
    const { data, error } = await supabase
      .from('wishlists')
      .select('id, notes, priority, added_at, venue:venues(id, name, lat, lng, address, google_place_id)')
    if (error) throw error
    if (data) {
      const mapped = data.filter(w => w.venue).map(w => ({
        ...w.venue!,
        wishlistId: w.id,
        wishlistNotes: w.notes,
        wishlistPriority: w.priority,
        wishlistAddedAt: w.added_at,
      }))
      setWishlist(mapped)
      void saveCached(supabase, CACHE_KEYS.wishlistMap, mapped)
    }
  }

  async function fetchMemories() {
    const { data, error } = await supabase
      .from('memories')
      .select('*, venue:venues(*), memory_photos(*)')
      .order('visited_at', { ascending: false })
    if (error) throw error
    if (data) {
      setMemories(data as MemoryWithDetails[])
      void saveCached(supabase, CACHE_KEYS.memories, data)
      // Warm the signed-URL cache for every pin's thumbnail in ONE
      // round-trip, instead of a request per pin as markers mount.
      const pinThumbs = (data as MemoryWithDetails[])
        .map(m => m.memory_photos?.[0]?.storage_path)
        .filter((p): p is string => Boolean(p))
        .map(p => thumbPath(p))
      if (pinThumbs.length > 0) void getSignedPhotoUrls(supabase, pinThumbs)
    }
  }

  async function loadAll() {
    try {
      await Promise.all([fetchMemories(), fetchWishlist()])
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }

  // Hydrate pins from the offline snapshot for instant paint (and
  // airplane mode) — the network refresh below replaces it when it lands.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [mems, wish] = await Promise.all([
        loadCached<MemoryWithDetails[]>(supabase, CACHE_KEYS.memories),
        loadCached<WishlistVenue[]>(supabase, CACHE_KEYS.wishlistMap),
      ])
      if (cancelled) return
      if (mems) setMemories(prev => (prev.length === 0 ? mems : prev))
      if (wish) setWishlist(prev => (prev.length === 0 ? wish : prev))
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refetch whenever the map becomes visible again — cheap data refresh,
  // no map remount (so no billed Maps load on tab switches).
  useEffect(() => {
    if (!visible) return
    const run = async () => { await loadAll() }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  // Don't mount the map behind the auth screens — first login mounts it once.
  if (onAuth) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      paddingTop: 'env(safe-area-inset-top, 0px)',
      // When not on the map, slide the whole shell off-screen rather than
      // overlaying invisibly — an invisible full-screen fixed element breaks
      // body scrolling in the iOS WebView. The map instance stays mounted
      // (no billed reload) and keeps its size, so returning is instant.
      transform: visible ? 'none' : 'translateX(-100%)',
      visibility: visible ? 'visible' : 'hidden',
      pointerEvents: visible ? 'auto' : 'none',
      zIndex: visible ? 0 : -1,
    }}>

        <Map
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={13}
          minZoom={4}
          maxZoom={19}
          restriction={{
            latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
            strictBounds: true,
          }}
          mapId='4b5d4b2acae16b2a1f55f13f'
          disableDefaultUI={true}
          gestureHandling="greedy"
          style={{ width: '100%', height: '100%' }}
        >
          {showWishlist && wishlist.filter(v => !(v.lat === 0 && v.lng === 0)).map(venue => (
            <AdvancedMarker
              key={`wish-${venue.id}`}
              position={{ lat: venue.lat, lng: venue.lng }}
              onClick={() => { setSelectedWishlist(venue); setSelected(null); setShowAddSheet(false) }}
            >
              <WishlistPin name={venue.name} isSelected={selectedWishlist?.id === venue.id} />
            </AdvancedMarker>
          ))}
          <ClusteredMarkers
            memories={showMemories ? memories : []}
            selected={selected}
            onSelect={(m) => { setSelected(m); setShowAddSheet(false) }}
          />
          <FitToData points={[
            ...memories.filter(m => m.venue && !(m.venue.lat === 0 && m.venue.lng === 0)).map(m => ({ lat: m.venue!.lat, lng: m.venue!.lng })),
            ...wishlist.filter(v => !(v.lat === 0 && v.lng === 0)).map(v => ({ lat: v.lat, lng: v.lng })),
          ]} />
        </Map>

      {/* Load error banner */}
      {loadError && (
        <div className="rise absolute left-4 right-4 z-20 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 60px)', background: 'rgba(163,45,45,0.95)', backdropFilter: 'blur(12px)' }}>
          <p className="text-xs font-medium text-white">Couldn&apos;t load your memories. Check your connection.</p>
          <button onClick={loadAll} className="text-xs font-semibold px-3 py-1.5 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
            Retry
          </button>
        </div>
      )}

      {/* Notification banner — friend requests and memory throwbacks */}
      {!loadError && bannerItem && (
        <button
          onClick={() => openBanner(bannerItem)}
          className="rise absolute left-4 right-4 z-20 flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 60px)',
            background: 'rgba(16,20,22,0.88)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '0.5px solid rgba(201,168,106,0.4)',
            boxShadow: '0 8px 28px rgba(16,20,22,0.35)',
          }}>
          <Icon name={bannerItem.kind === 'friend_request' ? 'friend-add' : 'camera'} size={22} color="var(--gold-500)" strokeWidth={1.8} />

          <span className="flex-1">
            {bannerItem.kind === 'friend_request' && (
              <>
                <span className="block text-xs font-semibold" style={{ color: 'var(--gold-500)' }}>Friend request</span>
                <span className="block text-sm font-semibold text-white">{bannerItem.name} wants to add you</span>
              </>
            )}
            {bannerItem.kind === 'anniversary' && (
              <>
                <span className="block text-xs font-semibold" style={{ color: 'var(--gold-500)' }}>
                  On this day · {bannerItem.yearsAgo} {bannerItem.yearsAgo === 1 ? 'year' : 'years'} ago
                </span>
                <span className="block text-sm font-semibold text-white">{bannerItem.title}</span>
              </>
            )}
          </span>
          <span
            role="button"
            onClick={e => { e.stopPropagation(); dismissBanner(bannerItem.id) }}
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            ✕
          </span>
        </button>
      )}

      {/* Unified header bar */}
      <div className="rise absolute left-0 right-0 z-10 flex items-center justify-between px-4"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)', pointerEvents: 'none' }}>
        {/* Logo + count */}
        <div className="glass-pill flex items-center gap-2 px-3 py-1.5 rounded-2xl pointer-events-auto">
          <img src="/logo.png" alt="Mimora" style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--teal-600)' }}>Mimora</span>
          <span className="text-xs" style={{ color: 'var(--slate)' }}>· {memories.length}</span>
        </div>
        {/* Toggles */}
        <div className="flex gap-1.5 pointer-events-auto">
          <button onClick={() => setShowMemories(v => !v)}
            className="glass-pill press flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: showMemories ? 'var(--stone-200)' : undefined, color: showMemories ? 'var(--teal-600)' : 'var(--slate)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: showMemories ? 'var(--gold-500)' : 'var(--slate-light)' }} />
            Memories
          </button>
          <button onClick={() => setShowWishlist(v => !v)}
            className="glass-pill press flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: showWishlist ? 'var(--stone-200)' : undefined, color: showWishlist ? 'var(--teal-600)' : 'var(--slate)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: showWishlist ? '#fff' : 'var(--slate-light)' }} />
            Wishlist
          </button>
        </div>
      </div>

      <AddMemoryButton onClick={() => { setShowAddSheet(true); setSelected(null) }} />

      {selected && (
        <MemorySheet memory={selected} onClose={() => setSelected(null)} onUpdate={loadAll} />
      )}
      {selectedWishlist && (
        <WishlistSheet
          item={{
            id: selectedWishlist.wishlistId,
            notes: selectedWishlist.wishlistNotes,
            priority: selectedWishlist.wishlistPriority,
            added_at: selectedWishlist.wishlistAddedAt,
            venue: {
              id: selectedWishlist.id,
              name: selectedWishlist.name,
              address: selectedWishlist.address,
              google_place_id: selectedWishlist.google_place_id,
              lat: selectedWishlist.lat,
              lng: selectedWishlist.lng,
            }
          }}
          onClose={() => setSelectedWishlist(null)}
          onUpdate={() => { loadAll(); setSelectedWishlist(null) }}
        />
      )}
      {showAddSheet && (
        <MemorySheet
          memory={null}
          onClose={() => setShowAddSheet(false)}
          onUpdate={() => { loadAll(); setShowAddSheet(false) }}
        />
      )}
    </div>
  )
}

// Fits the map to the user's pins once they load (instead of staying on the
// hardcoded London default). Runs once; the user can pan freely after.
function FitToData({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (!map || fitted.current || points.length === 0) return
    if (points.length === 1) {
      map.setCenter(points[0])
      map.setZoom(14)
    } else {
      const bounds = new google.maps.LatLngBounds()
      points.forEach(p => bounds.extend(p))
      map.fitBounds(bounds, 80)
    }
    fitted.current = true
  }, [map, points])
  return null
}

// Clustered markers — groups overlapping pins
function ClusteredMarkers({
  memories, selected, onSelect,
}: {
  memories: MemoryWithDetails[]
  selected: MemoryWithDetails | null
  onSelect: (m: MemoryWithDetails) => void
}) {
  const map = useMap()
  const clusterer = useRef<MarkerClusterer | null>(null)
  const markerRefs = useRef<Record<string, google.maps.marker.AdvancedMarkerElement>>({})

  useEffect(() => {
    if (!map) return
    if (!clusterer.current) {
      clusterer.current = new MarkerClusterer({
        map,
        renderer: {
          render: ({ count, position }) => {
            const el = document.createElement('div')
            el.style.cssText = `
              width: 44px; height: 44px; border-radius: 50%;
              background: #fff; border: 0.5px solid rgba(16,20,22,0.12);
              display: flex; align-items: center; justify-content: center;
              color: #16191B; font-size: 13px; font-weight: 600;
              box-shadow: 0 4px 12px rgba(16,20,22,0.18);
              cursor: pointer;
            `
            el.textContent = String(count)
            return new google.maps.marker.AdvancedMarkerElement({ position, content: el })
          },
        },
      })
    }
  }, [map])

  // Refetches produce a new `memories` array with mostly the same ids, so
  // React reuses the AdvancedMarker elements and their ref callbacks never
  // re-fire. Rebuild the clusterer from the still-mounted markers instead
  // of wiping it — wiping left it empty and the pins vanished until a
  // toggle forced a remount.
  useEffect(() => {
    if (!clusterer.current) return
    clusterer.current.clearMarkers()
    const live = Object.values(markerRefs.current)
    if (live.length > 0) clusterer.current.addMarkers(live as unknown as google.maps.Marker[])
  }, [memories])

  return (
    <>
      {memories.map((memory) => {
        // No venue, or a venue saved without a location (0,0 = "Null
        // Island" in the Atlantic) — nothing sensible to pin.
        if (!memory.venue || (memory.venue.lat === 0 && memory.venue.lng === 0)) return null
        return (
          <AdvancedMarker
            key={memory.id}
            position={{ lat: memory.venue.lat, lng: memory.venue.lng }}
            onClick={() => onSelect(memory)}
            ref={(marker) => {
              if (marker && clusterer.current) {
                markerRefs.current[memory.id] = marker
                clusterer.current.addMarker(marker as unknown as google.maps.Marker)
              } else if (!marker) {
                delete markerRefs.current[memory.id]
              }
            }}
          >
            <MemoryPin memory={memory} isSelected={selected?.id === memory.id} />
          </AdvancedMarker>
        )
      })}
    </>
  )
}

// Wishlist pin — gold bookmark style
function WishlistPin({ name, isSelected }: { name: string; isSelected: boolean }) {
  const size = isSelected ? 48 : 40
  return (
    <div className="flex flex-col items-center" style={{ cursor: 'pointer' }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: isSelected ? 'var(--gold-500)' : '#fff',
        border: `3px solid ${isSelected ? '#fff' : 'var(--gold-500)'}`,
        boxShadow: isSelected ? '0 4px 16px rgba(201,168,106,0.5)' : '0 2px 8px rgba(201,168,106,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease',
      }}>
        <svg width={isSelected ? 22 : 18} height={isSelected ? 22 : 18} viewBox="0 0 24 24" fill={isSelected ? '#fff' : 'var(--gold-500)'}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div style={{ width: 2, height: 6, background: 'var(--gold-500)', borderRadius: 1 }} />
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gold-500)' }} />
      <div style={{
        marginTop: 2, background: isSelected ? 'var(--gold-500)' : 'rgba(255,255,255,0.95)', borderRadius: 6,
        padding: '2px 6px', fontSize: 10, fontWeight: 600,
        color: isSelected ? '#fff' : 'var(--teal-600)',
        maxWidth: 90, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
      }}>{name}</div>
    </div>
  )
}
