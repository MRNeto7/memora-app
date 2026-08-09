'use client'

import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { createClient } from '@/lib/supabase/client'
import { getSignedPhotoUrls, thumbPath } from '@/lib/storage'
import { loadCached, saveCached, CACHE_KEYS } from '@/lib/offlineData'
import { EXPLORE_VENUES, ExploreVenue } from '@/lib/explore'
import { toast } from '@/lib/toast'
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
  const [showExplore, setShowExplore] = useState(false)
  const [selectedExplore, setSelectedExplore] = useState<ExploreVenue | null>(null)
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
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return
    const { data, error } = await supabase
      .from('wishlists')
      .select('id, notes, priority, added_at, venue:venues(id, name, lat, lng, address, google_place_id)')
      .eq('user_id', uid)
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
    // Owner-scoped — RLS also exposes friends' shared memories, which must
    // not appear as your own pins
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return
    const { data, error } = await supabase
      .from('memories')
      .select('*, venue:venues(*), memory_photos(*)')
      .eq('user_id', uid)
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

  // Explore pins have no Google place id — venues are created from the
  // curated data (deduped by exact name) and added to the wishlist.
  async function addExploreToWishlist(v: ExploreVenue) {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return
    let venueId: string | null = null
    const { data: existing } = await supabase.from('venues').select('id').eq('name', v.name).limit(1)
    if (existing && existing[0]) venueId = existing[0].id
    else {
      const { data: nv } = await supabase.from('venues')
        .insert({ name: v.name, lat: v.lat, lng: v.lng, address: v.address, google_place_id: null })
        .select('id').single()
      venueId = nv?.id ?? null
    }
    if (!venueId) { toast('Couldn’t add — please try again.', 'error'); return }
    const { error } = await supabase.from('wishlists').insert({ user_id: uid, venue_id: venueId })
    if (error && error.code !== '23505') { toast('Couldn’t add — please try again.', 'error'); return }
    toast(error?.code === '23505' ? 'Already on your wishlist' : `${v.name} added to your wishlist`)
    setSelectedExplore(null)
    void fetchWishlist()
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
          // Pre-tile canvas colour — the cloud map style dates from the teal
          // era, so without this the map flashes fullscreen green on launch
          // like a second splash screen
          backgroundColor={'#F6F7F8'}
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
          {showExplore && (
            <ExploreClusteredMarkers
              venues={EXPLORE_VENUES}
              onSelect={(v) => { setSelectedExplore(v); setSelected(null); setSelectedWishlist(null); setShowAddSheet(false) }}
            />
          )}
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
            background: 'rgba(255,255,255,0.94)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '0.5px solid rgba(16,20,22,0.1)',
            boxShadow: 'var(--shadow-raised)',
          }}>
          <Icon name={bannerItem.kind === 'friend_request' ? 'friend-add' : 'camera'} size={22} color="var(--slate)" strokeWidth={1.8} />

          <span className="flex-1">
            {bannerItem.kind === 'friend_request' && (
              <>
                <span className="block text-xs font-semibold" style={{ color: 'var(--slate)' }}>Friend request</span>
                <span className="block text-sm font-semibold" style={{ color: 'var(--teal-600)' }}>{bannerItem.name} wants to add you</span>
              </>
            )}
            {bannerItem.kind === 'anniversary' && (
              <>
                <span className="block text-xs font-semibold" style={{ color: 'var(--slate)' }}>
                  On this day · {bannerItem.yearsAgo} {bannerItem.yearsAgo === 1 ? 'year' : 'years'} ago
                </span>
                <span className="block text-sm font-semibold" style={{ color: 'var(--teal-600)' }}>{bannerItem.title}</span>
              </>
            )}
          </span>
          <span
            role="button"
            onClick={e => { e.stopPropagation(); dismissBanner(bannerItem.id) }}
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--stone-200)', color: 'var(--slate)', fontSize: 12 }}>
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
          <span className="text-xs font-semibold" style={{ color: 'var(--slate)' }}>{memories.length}</span>
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
          <button onClick={() => { setShowExplore(v => { const next = !v; if (!next) setSelectedExplore(null); return next }) }}
            className="glass-pill press flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: showExplore ? 'var(--stone-200)' : undefined, color: showExplore ? 'var(--teal-600)' : 'var(--slate)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: showExplore ? 'var(--gold-500)' : 'var(--slate-light)' }} />
            Explore
          </button>
        </div>
      </div>

      {/* Explore venue card — curated data, add straight to wishlist */}
      {selectedExplore && (
        <div className="rise absolute left-4 right-4 z-20 rounded-2xl p-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 108px)', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)', border: '0.5px solid rgba(16,20,22,0.1)', boxShadow: 'var(--shadow-raised)' }}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="font-semibold text-base leading-tight" style={{ color: 'var(--teal-600)' }}>{selectedExplore.name}</p>
            <button onClick={() => setSelectedExplore(null)}
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--stone-200)', color: 'var(--slate)', fontSize: 12 }}>✕</button>
          </div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--gold-700)' }}>
            {'★'.repeat(selectedExplore.stars)}<span className="ml-1.5" style={{ color: 'var(--slate)' }}>Michelin-starred · 2025 guide</span>
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--slate)' }}>{selectedExplore.address}</p>
          <button onClick={() => addExploreToWishlist(selectedExplore)}
            className="press w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: 'var(--stone-200)', color: 'var(--teal-600)' }}>
            <Icon name="bookmark" size={14} color="var(--gold-500)" />
            Add to wishlist
          </button>
        </div>
      )}

      <AddMemoryButton onClick={() => { setShowAddSheet(true); setSelected(null); setSelectedExplore(null) }} />

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

// Opens the map on the user's HOME CLUSTER — the densest group of pins —
// rather than the bounding box of everything. Fitting all pins meant one
// holiday (e.g. Madeira + a London life) centred the camera mid-ocean.
// Distant trips stay one pan away. Runs once; the user pans freely after.
const CLUSTER_RADIUS_DEG = 1.5 // ≈150km — city-scale neighbourhood

function homeCluster(points: { lat: number; lng: number }[]): { lat: number; lng: number }[] {
  let best = points
  let bestCount = 1
  for (const p of points) {
    const near = points.filter(q =>
      Math.abs(q.lat - p.lat) <= CLUSTER_RADIUS_DEG && Math.abs(q.lng - p.lng) <= CLUSTER_RADIUS_DEG)
    if (near.length > bestCount) { bestCount = near.length; best = near }
  }
  return best
}

function FitToData({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (!map || fitted.current || points.length === 0) return
    const home = homeCluster(points)
    if (home.length === 1) {
      map.setCenter(home[0])
      map.setZoom(14)
    } else {
      const bounds = new google.maps.LatLngBounds()
      home.forEach(p => bounds.extend(p))
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



// Clustered explore layer. Built imperatively: markers are handed to the
// clusterer at construction so it owns them outright — the React-marker +
// ref-timing approach left the clusterer empty and pins unclustered.
function ExploreClusteredMarkers({ venues, onSelect }: {
  venues: ExploreVenue[]
  onSelect: (v: ExploreVenue) => void
}) {
  const map = useMap()
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!map) return
    const markers = venues.map(v => {
      const el = document.createElement('div')
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;'
      const label = `${'★'.repeat(v.stars)} ${v.name}`.replace(/</g, '&lt;')
      el.innerHTML = `
        <div style="width:34px;height:34px;border-radius:50%;background:#fff;border:2px solid rgba(16,20,22,0.15);box-shadow:0 2px 8px rgba(16,20,22,0.18);display:flex;align-items:center;justify-content:center;font-size:13px;color:#C9A86A;">★</div>
        <div style="margin-top:2px;background:rgba(255,255,255,0.95);border-radius:6px;padding:2px 6px;font-size:10px;font-weight:600;color:#16191B;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.1);">${label}</div>`
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: v.lat, lng: v.lng },
        content: el,
        gmpClickable: true,
      })
      marker.addListener('click', () => onSelectRef.current(v))
      return marker
    })
    const clusterer = new MarkerClusterer({
      map,
      markers: markers as unknown as google.maps.Marker[],
      renderer: {
        render: ({ count, position }) => {
          const el = document.createElement('div')
          el.style.cssText = `
            width: 40px; height: 40px; border-radius: 50%;
            background: #fff; border: 0.5px solid rgba(16,20,22,0.15);
            display: flex; align-items: center; justify-content: center;
            color: #16191B; font-size: 12px; font-weight: 600;
            box-shadow: 0 4px 12px rgba(16,20,22,0.18);
            cursor: pointer;
          `
          el.textContent = `★${count}`
          return new google.maps.marker.AdvancedMarkerElement({ position, content: el })
        },
      },
    })
    return () => {
      clusterer.clearMarkers()
      markers.forEach(m => { m.map = null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  return null
}
