'use client'

import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import { useState, useEffect, useRef } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { createClient } from '@/lib/supabase/client'
import { MemoryWithDetails } from '@/lib/types/database'
import MemorySheet from '@/components/memory/MemorySheet'
import MemoryPin from '@/components/map/MemoryPin'
import AddMemoryButton from '@/components/memory/AddMemoryButton'

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!
const DEFAULT_CENTER = { lat: 51.505, lng: -0.09 }



export default function MapPage() {
  const [memories, setMemories] = useState<MemoryWithDetails[]>([])
  const [selected, setSelected] = useState<MemoryWithDetails | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  useEffect(() => { fetchMemories() }, [])

  async function fetchMemories() {
    const { data, error } = await supabase
      .from('memories')
      .select('*, venue:venues(*), memory_photos(*)')
      .order('visited_at', { ascending: false })
    if (!error && data) setMemories(data as MemoryWithDetails[])
  }

  return (
    <div style={{ height: 'calc(100vh - 80px)', position: 'relative' }}>
      <APIProvider apiKey={MAPS_KEY} libraries={['places']}>

        {/* Header pill */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
          <div
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl pointer-events-auto"
            style={{
              background: 'rgba(234,229,221,0.96)',
              backdropFilter: 'blur(12px)',
              border: '0.5px solid rgba(13,79,87,0.12)',
            }}
          >
            <img src="/logo.png" alt="Memora" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
            <span className="font-semibold text-sm" style={{ color: '#0D4F57' }}>Memora</span>
            <span className="text-xs" style={{ color: '#7D878D' }}>
              · {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
            </span>
          </div>
        </div>

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
          <ClusteredMarkers
            memories={memories}
            selected={selected}
            onSelect={(m) => { setSelected(m); setShowAddSheet(false) }}
          />
        </Map>
      </APIProvider>

      <AddMemoryButton onClick={() => { setShowAddSheet(true); setSelected(null) }} />

      {selected && (
        <MemorySheet memory={selected} onClose={() => setSelected(null)} onUpdate={fetchMemories} />
      )}
      {showAddSheet && (
        <MemorySheet
          memory={null}
          onClose={() => setShowAddSheet(false)}
          onUpdate={() => { fetchMemories(); setShowAddSheet(false) }}
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRefs = useRef<Record<string, any>>({})

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
