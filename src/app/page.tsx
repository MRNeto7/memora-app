'use client'

import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import { useState, useEffect, useRef } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { createClient } from '@/lib/supabase/client'
import { MemoryWithDetails } from '@/lib/types/database'
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



export default function MapPage() {
  const [memories, setMemories] = useState<MemoryWithDetails[]>([])
  const [selected, setSelected] = useState<MemoryWithDetails | null>(null)
  const [selectedWishlist, setSelectedWishlist] = useState<WishlistVenue | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const supabase = createClient()

  const [wishlist, setWishlist] = useState<WishlistVenue[]>([])
  const [showMemories, setShowMemories] = useState(true)
  const [showWishlist, setShowWishlist] = useState(true)
  const [loadError, setLoadError] = useState(false)

  async function fetchWishlist() {
    const { data, error } = await supabase
      .from('wishlists')
      .select('id, notes, priority, added_at, venue:venues(id, name, lat, lng, address, google_place_id)')
    if (error) throw error
    if (data) setWishlist(data.filter(w => w.venue).map(w => ({
      ...w.venue!,
      wishlistId: w.id,
      wishlistNotes: w.notes,
      wishlistPriority: w.priority,
      wishlistAddedAt: w.added_at,
    })))
  }

  async function fetchMemories() {
    const { data, error } = await supabase
      .from('memories')
      .select('*, venue:venues(*), memory_photos(*)')
      .order('visited_at', { ascending: false })
    if (error) throw error
    if (data) setMemories(data as MemoryWithDetails[])
  }

  async function loadAll() {
    try {
      await Promise.all([fetchMemories(), fetchWishlist()])
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }

  useEffect(() => {
    const load = async () => { await loadAll() }
    load()
  }, [])

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}>


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
          {showWishlist && wishlist.map(venue => (
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
        </Map>

      {/* Load error banner */}
      {loadError && (
        <div className="absolute left-4 right-4 z-20 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 60px)', background: 'rgba(163,45,45,0.95)', backdropFilter: 'blur(12px)' }}>
          <p className="text-xs font-medium text-white">Couldn&apos;t load your memories. Check your connection.</p>
          <button onClick={loadAll} className="text-xs font-semibold px-3 py-1.5 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
            Retry
          </button>
        </div>
      )}

      {/* Unified header bar */}
      <div className="absolute left-0 right-0 z-10 flex items-center justify-between px-4"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)', pointerEvents: 'none' }}>
        {/* Logo + count */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl pointer-events-auto"
          style={{ background: 'rgba(234,229,221,0.96)', backdropFilter: 'blur(12px)', border: '0.5px solid rgba(13,79,87,0.12)' }}>
          <img src="/logo.png" alt="Mimora" style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover' }} />
          <span className="font-semibold text-sm" style={{ color: '#0D4F57' }}>Mimora</span>
          <span className="text-xs" style={{ color: '#7D878D' }}>· {memories.length}</span>
        </div>
        {/* Toggles */}
        <div className="flex gap-1.5 pointer-events-auto">
          <button onClick={() => setShowMemories(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: showMemories ? '#0D4F57' : 'rgba(234,229,221,0.96)', color: showMemories ? '#EAE5DD' : '#7D878D', backdropFilter: 'blur(12px)', border: '0.5px solid rgba(13,79,87,0.12)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: showMemories ? '#C9A86A' : '#b0babe' }} />
            Memories
          </button>
          <button onClick={() => setShowWishlist(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: showWishlist ? '#C9A86A' : 'rgba(234,229,221,0.96)', color: showWishlist ? '#fff' : '#7D878D', backdropFilter: 'blur(12px)', border: '0.5px solid rgba(13,79,87,0.12)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: showWishlist ? '#fff' : '#b0babe' }} />
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
              background: #0D4F57; border: 3px solid #C9A86A;
              display: flex; align-items: center; justify-content: center;
              color: #fff; font-size: 13px; font-weight: 600;
              box-shadow: 0 4px 12px rgba(13,79,87,0.4);
              cursor: pointer;
            `
            el.textContent = String(count)
            return new google.maps.marker.AdvancedMarkerElement({ position, content: el })
          },
        },
      })
    }
  }, [map])

  useEffect(() => {
    if (!clusterer.current) return
    clusterer.current.clearMarkers()
    markerRefs.current = {}
  }, [memories])

  return (
    <>
      {memories.map((memory) => {
        if (!memory.venue) return null
        return (
          <AdvancedMarker
            key={memory.id}
            position={{ lat: memory.venue.lat, lng: memory.venue.lng }}
            onClick={() => onSelect(memory)}
            ref={(marker) => {
              if (marker && clusterer.current) {
                markerRefs.current[memory.id] = marker
                clusterer.current.addMarker(marker as unknown as google.maps.Marker)
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
        background: isSelected ? '#C9A86A' : '#fff',
        border: `3px solid ${isSelected ? '#fff' : '#C9A86A'}`,
        boxShadow: isSelected ? '0 4px 16px rgba(201,168,106,0.5)' : '0 2px 8px rgba(201,168,106,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease',
      }}>
        <svg width={isSelected ? 22 : 18} height={isSelected ? 22 : 18} viewBox="0 0 24 24" fill={isSelected ? '#fff' : '#C9A86A'}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div style={{ width: 2, height: 6, background: '#C9A86A', borderRadius: 1 }} />
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#C9A86A' }} />
      <div style={{
        marginTop: 2, background: isSelected ? '#C9A86A' : 'rgba(255,255,255,0.95)', borderRadius: 6,
        padding: '2px 6px', fontSize: 10, fontWeight: 600,
        color: isSelected ? '#fff' : '#0D4F57',
        maxWidth: 90, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
      }}>{name}</div>
    </div>
  )
}
