'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSignedPhotoUrl } from '@/lib/storage'
import { MemoryWithDetails } from '@/lib/types/database'
import Icon from '@/components/ui/Icon'
import MemorySheet from '@/components/memory/MemorySheet'

export default function MemoriesPage() {
  const [memories, setMemories] = useState<MemoryWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<MemoryWithDetails | null>(null)
  const supabase = createClient()

  async function fetchMemories() {
    const { data, error } = await supabase
      .from('memories')
      .select('*, venue:venues(*), memory_photos(*)')
      .order('visited_at', { ascending: false })
    if (error) setLoadError(true)
    else { setLoadError(false); if (data) setMemories(data as MemoryWithDetails[]) }
    setLoading(false)
  }

  function retryFetch() {
    setLoading(true)
    setLoadError(false)
    fetchMemories()
  }

  useEffect(() => {
    const load = async () => { await fetchMemories() }
    load()
  }, [])

  // Group by month
  const grouped = memories.reduce((acc, memory) => {
    const date = new Date(memory.visited_at)
    const key = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (!acc[key]) acc[key] = []
    acc[key].push(memory)
    return acc
  }, {} as Record<string, MemoryWithDetails[]>)

  return (
    <div className="page-enter min-h-screen" style={{ background: 'var(--stone)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div
        className="page-header px-5 pb-4"
      >
        <h1 className="text-xl font-semibold text-white">My memories</h1>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {memories.length} {memories.length === 1 ? 'memory' : 'memories'} saved
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm" style={{ color: 'var(--slate)' }}>Loading…</div>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <h2 className="font-semibold text-base mb-2" style={{ color: 'var(--teal-600)' }}>Couldn&apos;t load your memories</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--slate)' }}>Check your connection and try again</p>
          <button onClick={retryFetch} className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--teal-600)', color: 'var(--stone-400)' }}>
            Retry
          </button>
        </div>
      ) : memories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#fff', marginBottom: 16 }}>
            <Icon name="map" size={30} color="var(--gold-500)" strokeWidth={1.4} />
          </div>
          <h2 className="font-semibold text-base mb-2" style={{ color: 'var(--teal-600)' }}>No memories yet</h2>
          <p className="text-sm" style={{ color: 'var(--slate)' }}>Go to the Map tab and save your first memory</p>
        </div>
      ) : (
        <div className="px-4 pt-4">
          {Object.entries(grouped).map(([month, monthMemories]) => (
            <div key={month} className="mb-6">
              {/* Month header */}
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--slate)' }}>{month}</p>
                <div className="flex-1 h-px" style={{ background: 'rgba(13,79,87,0.1)' }} />
                <p className="text-xs" style={{ color: 'var(--slate-light)' }}>{monthMemories.length}</p>
              </div>

              {/* Memory cards */}
              <div className="flex flex-col gap-3">
                {monthMemories.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onClick={() => setSelected(memory)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <MemorySheet
          memory={selected}
          onClose={() => setSelected(null)}
          onUpdate={fetchMemories}
        />
      )}
    </div>
  )
}

function MemoryCard({ memory, onClick }: { memory: MemoryWithDetails; onClick: () => void }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const supabase = createClient()
  const firstPhoto = memory.memory_photos?.[0]

  useEffect(() => {
    if (!firstPhoto) return
    async function load() {
      const url = await getSignedPhotoUrl(supabase, firstPhoto!.storage_path)
      if (url) setPhotoUrl(url)
    }
    load()
  }, [firstPhoto?.storage_path])

  const date = new Date(memory.visited_at)

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl overflow-hidden transition-transform active:scale-98"
      style={{
        background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(13,79,87,0.06)',
      }}
    >
      <div className="flex">
        {/* Photo thumbnail */}
        <div
          className="flex-shrink-0"
          style={{ width: 88, height: 88, background: 'var(--stone-400)', position: 'relative', overflow: 'hidden' }}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'var(--teal-600)' }}
              >
                <span className="text-white text-sm font-semibold">
                  {memory.venue?.name?.slice(0, 2).toUpperCase() ?? 'M'}
                </span>
              </div>
            </div>
          )}
          {/* Photo count badge */}
          {memory.memory_photos.length > 1 && (
            <div
              className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-white"
              style={{ background: 'rgba(0,0,0,0.5)', fontSize: 10 }}
            >
              +{memory.memory_photos.length - 1}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 px-4 py-3">
          <div className="flex items-start justify-between mb-1">
            <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--teal-600)' }}>
              {memory.venue?.name ?? 'Unknown location'}
            </p>
            {memory.rating && (
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                <Icon name="star" size={11} color="var(--gold-500)" fill="#C9A86A" />
                <span className="text-xs font-medium" style={{ color: 'var(--gold-500)' }}>{memory.rating}</span>
              </div>
            )}
          </div>

          {memory.venue?.address && (
            <p className="text-xs mb-1.5 truncate" style={{ color: 'var(--slate)' }}>
              {memory.venue.address}
            </p>
          )}

          {memory.dish_name && (
            <p className="text-xs mb-1.5 italic" style={{ color: 'var(--slate)' }}>
              {memory.dish_name}
            </p>
          )}

          <div className="flex items-center gap-3">
            <p className="text-xs" style={{ color: 'var(--slate-light)' }}>
              {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {memory.venue?.category && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'var(--teal-pale)', color: 'var(--teal-600)' }}
              >
                {memory.venue.category}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <div className="flex items-center pr-3" style={{ color: 'var(--slate-light)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>
    </button>
  )
}
