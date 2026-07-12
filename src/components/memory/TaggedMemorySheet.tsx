'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MemoryWithDetails } from '@/lib/types/database'
import { getSignedPhotoUrl } from '@/lib/storage'
import Icon from '@/components/ui/Icon'
import Portal from '@/components/ui/Portal'

// Preview of a memory you were tagged in, with the copy-on-tag action:
// "Save to my profile" creates YOUR OWN memory (linked via
// origin_memory_id) with the photos copied server-side into your storage
// folder. Ratings and notes start blank — they're personal.
export default function TaggedMemorySheet({ tagId, memoryId, taggerName, onClose, onChanged }: {
  tagId: string
  memoryId: string
  taggerName: string
  onClose: () => void
  onChanged: () => void
}) {
  const supabase = createClient()
  const [memory, setMemory] = useState<MemoryWithDetails | null>(null)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('memories').select('*, venue:venues(*), memory_photos(*)').eq('id', memoryId).single()
      .then(({ data, error }) => {
        if (error || !data) setFailed(true)
        else setMemory(data as MemoryWithDetails)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoryId])

  async function handleSaveToProfile() {
    if (!memory || saving) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: copy, error } = await supabase.from('memories').insert({
        user_id: user.id,
        venue_id: memory.venue_id,
        visited_at: memory.visited_at,
        origin_memory_id: memory.id,
        is_public: false,
      }).select('id').single()
      if (error || !copy) { alert('Couldn’t save the memory — please try again.'); return }

      // Server-side copy into your own folder — keeps the basename so
      // linked versions can tell which photos they already share.
      let failedPhotos = 0
      for (const p of memory.memory_photos) {
        const base = p.storage_path.split('/').pop()!
        const dest = `${user.id}/${copy.id}/${base}`
        const { error: ce } = await supabase.storage.from('memory-photos').copy(p.storage_path, dest)
        if (ce) { failedPhotos++; continue }
        await supabase.from('memory_photos').insert({
          memory_id: copy.id, storage_path: dest, lat: p.lat, lng: p.lng, taken_at: p.taken_at,
        })
      }
      await supabase.from('memory_tags').update({ status: 'saved' }).eq('id', tagId)
      if (failedPhotos > 0) alert(`Saved, but ${failedPhotos === 1 ? 'one photo' : `${failedPhotos} photos`} couldn’t be copied.`)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function handleDismiss() {
    await supabase.from('memory_tags').update({ status: 'dismissed' }).eq('id', tagId)
    onChanged()
  }

  const date = memory ? new Date(memory.visited_at) : null

  return (
    <Portal>
      <div className="backdrop-enter fixed z-[80]" style={{ top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(13,79,87,0.4)', backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)' }} onClick={onClose} />
      <div className="fixed z-[90] flex items-start justify-center pointer-events-none" style={{ top: 0, left: 0, right: 0, bottom: 0, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        <div className="sheet-enter glass-modal relative w-full rounded-3xl overflow-hidden flex flex-col pointer-events-auto" style={{ maxHeight: '82vh', width: 'min(420px, 100%)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '0.5px solid rgba(13,79,87,0.08)' }}>
            <div className="flex items-center gap-2">
              <Icon name="pin" size={16} color="#C9A86A" />
              <h2 className="font-semibold text-sm" style={{ color: '#0D4F57' }}>{taggerName} tagged you</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(13,79,87,0.08)', color: '#7D878D', fontSize: 14 }}>✕</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {failed ? (
              <p className="text-sm text-center py-12 px-6" style={{ color: '#7D878D' }}>This memory isn’t available any more.</p>
            ) : !memory ? (
              <p className="text-sm text-center py-12" style={{ color: '#7D878D' }}>Loading…</p>
            ) : (
              <div className="px-5 py-4">
                <h3 className="text-lg font-semibold leading-tight mb-1" style={{ color: '#0D4F57' }}>{memory.venue?.name ?? 'A memory'}</h3>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {memory.venue?.address && <p className="text-xs" style={{ color: '#7D878D' }}>{memory.venue.address}</p>}
                  {date && (
                    <>
                      <span style={{ color: '#d4cdc3', fontSize: 10 }}>·</span>
                      <p className="text-xs" style={{ color: '#7D878D' }}>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </>
                  )}
                </div>

                {memory.memory_photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                    {memory.memory_photos.map(p => (
                      <div key={p.id} className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 84, height: 84, background: '#EAE5DD' }}>
                        <TaggedThumb path={p.storage_path} />
                      </div>
                    ))}
                  </div>
                )}

                {memory.dish_name && (
                  <p className="text-xs mb-3" style={{ color: '#7D878D' }}>They had: <span className="font-semibold" style={{ color: '#0D4F57' }}>{memory.dish_name}</span></p>
                )}

                <div className="rounded-xl px-3 py-2.5" style={{ background: '#f5f2ed' }}>
                  <p className="text-xs leading-relaxed" style={{ color: '#7D878D' }}>
                    Saving adds this to <span className="font-semibold" style={{ color: '#0D4F57' }}>your</span> memories with the photos copied over — then add your own rating, notes and photos. It stays private unless you share it.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {memory && !failed && (
            <div className="flex-shrink-0 px-5 pt-3 pb-4 flex flex-col gap-2" style={{ borderTop: '0.5px solid rgba(13,79,87,0.08)' }}>
              <button onClick={handleSaveToProfile} disabled={saving}
                className="press w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: '#0D4F57', color: '#EAE5DD', opacity: saving ? 0.6 : 1 }}>
                <Icon name="bookmark" size={15} color="#C9A86A" />
                {saving ? 'Saving…' : 'Save to my memories'}
              </button>
              <button onClick={handleDismiss} disabled={saving}
                className="press w-full py-2.5 rounded-xl text-xs font-medium"
                style={{ background: '#f5f2ed', color: '#7D878D' }}>
                No thanks
              </button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}

function TaggedThumb({ path }: { path: string }) {
  const supabase = createClient()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    getSignedPhotoUrl(supabase, path).then(u => { if (u) setUrl(u) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])
  if (!url) return <div className="w-full h-full animate-pulse" style={{ background: '#EAE5DD' }} />
  return <img src={url} className="w-full h-full" style={{ objectFit: 'cover', display: 'block' }} />
}
