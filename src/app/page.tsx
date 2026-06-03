'use client'

import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps'
import { useState, useEffect } from 'react'
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
      <APIProvider apiKey={MAPS_KEY}>

        {/* Header */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
          <div
            className="flex items-center gap-2.5 px-4 py-2 rounded-2xl pointer-events-auto"
            style={{ background: 'rgba(234,229,221,0.95)', backdropFilter: 'blur(10px)', border: '0.5px solid rgba(13,79,87,0.12)' }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#0D4F57' }}>
              <span className="text-white font-bold" style={{ fontSize: 11 }}>M</span>
            </div>
            <span className="font-semibold text-sm" style={{ color: '#0D4F57' }}>Memora</span>
            <span className="text-xs" style={{ color: '#7D878D' }}>· {memories.length} {memories.length === 1 ? 'memory' : 'memories'}</span>
          </div>
        </div>

        <Map
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={13}
          mapId="memora-map"
          disableDefaultUI={true}
          gestureHandling="greedy"
          style={{ width: '100%', height: '100%' }}
        >
          {memories.map((memory) => {
            if (!memory.venue) return null
            return (
              <AdvancedMarker
                key={memory.id}
                position={{ lat: memory.venue.lat, lng: memory.venue.lng }}
                onClick={() => { setSelected(memory); setShowAddSheet(false) }}
              >
                <MemoryPin memory={memory} isSelected={selected?.id === memory.id} />
              </AdvancedMarker>
            )
          })}
        </Map>
      </APIProvider>

      <AddMemoryButton onClick={() => { setShowAddSheet(true); setSelected(null) }} />

      {selected && (
        <MemorySheet memory={selected} onClose={() => setSelected(null)} onUpdate={fetchMemories} />
      )}
      {showAddSheet && (
        <MemorySheet memory={null} onClose={() => setShowAddSheet(false)} onUpdate={() => { fetchMemories(); setShowAddSheet(false) }} />
      )}
    </div>
  )
}
