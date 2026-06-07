'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MemoryWithDetails } from '@/lib/types/database'
import MemorySheet from '@/components/memory/MemorySheet'
import WishlistSheet from '@/components/wishlist/WishlistSheet'
import PlacePhoto from '@/components/ui/PlacePhoto'
import AddToWishlistButton from '@/components/wishlist/AddToWishlistButton'

interface WishlistItem {
  id: string
  notes: string | null
  priority: number
  added_at: string
  venue: {
    id: string
    name: string
    address: string | null
    google_place_id: string | null
    lat: number
    lng: number
  }
}

export default function PlacesPage() {
  const [tab, setTab] = useState<'memories' | 'wishlist'>('memories')
  const [memories, setMemories] = useState<MemoryWithDetails[]>([])
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMemory, setSelectedMemory] = useState<MemoryWithDetails | null>(null)
  const [selectedWishlist, setSelectedWishlist] = useState<WishlistItem | null>(null)
  const [showAddWishlist, setShowAddWishlist] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: mems }, { data: wish }] = await Promise.all([
      supabase.from('memories').select('*, venue:venues(*), memory_photos(*)').order('visited_at', { ascending: false }),
      supabase.from('wishlists').select('*, venue:venues(*)').order('priority', { ascending: false }).order('added_at', { ascending: false }),
    ])
    if (mems) setMemories(mems as MemoryWithDetails[])
    if (wish) setWishlist(wish as WishlistItem[])
    setLoading(false)
  }

  // Group memories by month
  const grouped = memories.reduce((acc, m) => {
    const key = new Date(m.visited_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, MemoryWithDetails[]>)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#EAE5DD', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Header */}
      <div className="page-header" style={{ paddingBottom: 0 }}>
        <div className="px-5 mb-4">
          <h1 className="text-xl font-semibold text-white">Places</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {memories.length} memories · {wishlist.length} on wishlist
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex px-5 gap-1">
          {(['memories', 'wishlist'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2.5 text-sm font-medium rounded-t-xl transition-all"
              style={{
                background: tab === t ? '#EAE5DD' : 'transparent',
                color: tab === t ? '#0D4F57' : 'rgba(255,255,255,0.6)',
              }}>
              {t === 'memories' ? `Memories (${memories.length})` : `Wishlist (${wishlist.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm" style={{ color: '#7D878D' }}>Loading…</p>
          </div>
        ) : tab === 'memories' ? (
          <>
            {memories.length === 0 ? (
              <EmptyState icon="📍" title="No memories yet" sub="Go to the Map and save your first memory" />
            ) : (
              Object.entries(grouped).map(([month, items]) => (
                <div key={month} className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#7D878D' }}>{month}</p>
                    <div className="flex-1 h-px" style={{ background: 'rgba(13,79,87,0.1)' }} />
                    <p className="text-xs" style={{ color: '#b0babe' }}>{items.length}</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {items.map(m => (
                      <MemoryCard key={m.id} memory={m} onClick={() => setSelectedMemory(m)} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            {/* Priority sections */}
            {wishlist.length === 0 ? (
              <EmptyState icon="🔖" title="Your wishlist is empty" sub="Add restaurants from the map or search for places to visit" />
            ) : (
              <div className="flex flex-col gap-3">
                {wishlist.map(item => (
                  <WishlistCard key={item.id} item={item} onClick={() => setSelectedWishlist(item)} onVisited={() => {}} onRemove={async () => {
                    await supabase.from('wishlists').delete().eq('id', item.id)
                    fetchAll()
                  }} />
                ))}
              </div>
            )}

            {/* Add to wishlist button */}
            <button
              onClick={() => setShowAddWishlist(true)}
              className="w-full mt-4 py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: '#0D4F57', color: '#EAE5DD' }}>
              <span style={{ fontSize: 18, color: '#C9A86A' }}>+</span>
              Add a restaurant
            </button>
          </>
        )}
      </div>

      {/* Sheets */}
      {selectedMemory && (
        <MemorySheet memory={selectedMemory} onClose={() => setSelectedMemory(null)} onUpdate={fetchAll} />
      )}
      {selectedWishlist && (
        <WishlistSheet item={selectedWishlist} onClose={() => setSelectedWishlist(null)} onUpdate={fetchAll} />
      )}
      {showAddWishlist && (
        <AddToWishlistButton onClose={() => setShowAddWishlist(false)} onSaved={fetchAll} />
      )}
    </div>
  )
}

function MemoryCard({ memory, onClick }: { memory: MemoryWithDetails; onClick: () => void }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const firstPhoto = memory.memory_photos?.[0]

  useEffect(() => {
    if (!firstPhoto) return
    supabase.storage.from('memory-photos').createSignedUrl(firstPhoto.storage_path, 3600)
      .then(({ data }: { data: { signedUrl: string } | null }) => { if (data?.signedUrl) setPhotoUrl(data.signedUrl) })
  }, [firstPhoto?.storage_path])

  return (
    <button onClick={onClick} className="w-full text-left rounded-2xl overflow-hidden active:scale-99 transition-transform"
      style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
      <div className="flex">
        <div className="flex-shrink-0 relative" style={{ width: 76, height: 76, background: '#EAE5DD', overflow: 'hidden', borderRadius: 12, margin: 6, flexShrink: 0 }}>
          {photoUrl
            ? <img src={photoUrl} className="w-full h-full" style={{ objectFit: 'cover', display: 'block' }} />
            : <div className="w-full h-full flex items-center justify-center">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#0D4F57' }}>
                  <span className="text-white text-xs font-semibold">{memory.venue?.name?.slice(0, 2).toUpperCase() ?? 'M'}</span>
                </div>
              </div>
          }
          {memory.memory_photos.length > 1 && (
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md text-white" style={{ background: 'rgba(0,0,0,0.5)', fontSize: 9 }}>
              +{memory.memory_photos.length - 1}
            </div>
          )}
        </div>
        <div className="flex-1 px-4 py-3">
          <div className="flex items-start justify-between mb-1">
            <p className="font-semibold text-sm" style={{ color: '#0D4F57' }}>{memory.venue?.name ?? 'Unknown'}</p>
            {memory.rating && (
              <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                <span style={{ fontSize: 11 }}>⭐</span>
                <span className="text-xs font-semibold" style={{ color: '#C9A86A' }}>{memory.rating}</span>
              </div>
            )}
          </div>
          {memory.venue?.address && <p className="text-xs mb-1 truncate" style={{ color: '#7D878D' }}>{memory.venue.address}</p>}
          {memory.dish_name && <p className="text-xs italic mb-1" style={{ color: '#7D878D' }}>{memory.dish_name}</p>}
          <p className="text-xs" style={{ color: '#b0babe' }}>
            {new Date(memory.visited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center pr-3" style={{ color: '#b0babe' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>
    </button>
  )
}

function WishlistCard({ item, onClick, onRemove }: {
  item: WishlistItem
  onClick: () => void
  onVisited: () => void
  onRemove: () => void
}) {
  const priorityColors = ['', '#b0babe', '#C9A86A', '#0D4F57']
  const priorityLabels = ['', 'Low', 'Medium', 'Must visit']

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
      <button onClick={onClick} className="w-full text-left">
        <div className="flex">
          {/* Restaurant photo */}
          <div className="flex-shrink-0" style={{ width: 76, height: 76, overflow: 'hidden', borderRadius: 12, margin: 6 }}>
            <PlacePhoto
              placeId={item.venue.google_place_id}
              width={200}
              fallbackInitials={item.venue.name.slice(0, 2).toUpperCase()}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <div className="flex-1 px-4 py-3">
            <div className="flex items-start justify-between mb-1">
              <p className="font-semibold text-sm flex-1 mr-2 leading-tight" style={{ color: '#0D4F57' }}>{item.venue.name}</p>
              {item.priority > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: `${priorityColors[item.priority]}18`, color: priorityColors[item.priority], border: `0.5px solid ${priorityColors[item.priority]}40` }}>
                  {priorityLabels[item.priority]}
                </span>
              )}
            </div>
            {item.venue.address && <p className="text-xs mb-1 truncate" style={{ color: '#7D878D' }}>{item.venue.address}</p>}
            {item.notes && <p className="text-xs italic truncate" style={{ color: '#7D878D' }}>{item.notes}</p>}
          </div>
        </div>
      </button>
      <div className="flex border-t" style={{ borderColor: 'rgba(13,79,87,0.06)' }}>
        <button onClick={onClick}
          className="flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5"
          style={{ color: '#0D4F57' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          View
        </button>
        <div style={{ width: '0.5px', background: 'rgba(13,79,87,0.06)' }} />
        <button onClick={onRemove}
          className="flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5"
          style={{ color: '#a32d2d' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          Remove
        </button>
      </div>
    </div>
  )
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span style={{ fontSize: 48, marginBottom: 16 }}>{icon}</span>
      <h2 className="font-semibold text-base mb-2" style={{ color: '#0D4F57' }}>{title}</h2>
      <p className="text-sm" style={{ color: '#7D878D' }}>{sub}</p>
    </div>
  )
}
