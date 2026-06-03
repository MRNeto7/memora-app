'use client'

import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MemoryWithDetails } from '@/lib/types/database'
import MemorySheet from '@/components/memory/MemorySheet'
import MemoryPin from '@/components/map/MemoryPin'
import AddMemoryButton from '@/components/memory/AddMemoryButton'
import UserMenu from '@/components/auth/UserMenu'

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!
const DEFAULT_CENTER = { lat: 51.505, lng: -0.09 }

export default function MapPage() {
  const [memories, setMemories] = useState<MemoryWithDetails[]>([])
  const [selected, setSelected] = useState<MemoryWithDetails | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  useEffect(() => {
    fetchMemories()
    fetchUser()
  }, [])

  async function fetchUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) setUserEmail(user.email)
  }

  async function fetchMemories() {
    const { data, error } = await supabase
      .from('memories')
      .select('*, venue:venues(*), memory_photos(*)')
      .order('visited_at', { ascending: false })

    if (!error && data) setMemories(data as MemoryWithDetails[])
  }

  return (
    <div className="map-container relative">
      <APIProvider apiKey={MAPS_KEY}>

        {/* Header */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
          <div
            className="bg-white rounded-2xl px-4 py-2 flex items-center gap-2"
            style={{ border: '1px solid #e8f0eb' }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: '#1e7a4c' }}
            >
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="font-semibold text-sm" style={{ color: '#1e7a4c' }}>Memora</span>
            <span className="text-xs text-gray-400 ml-1">{memories.length} memories</span>
          </div>

          {userEmail && <UserMenu email={userEmail} />}
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
                onClick={() => setSelected(memory)}
              >
                <MemoryPin memory={memory} isSelected={selected?.id === memory.id} />
              </AdvancedMarker>
            )
          })}
        </Map>
      </APIProvider>

      <AddMemoryButton onClick={() => setShowAddSheet(true)} />

      {selected && (
        <MemorySheet
          memory={selected}
          onClose={() => setSelected(null)}
          onUpdate={fetchMemories}
        />
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
