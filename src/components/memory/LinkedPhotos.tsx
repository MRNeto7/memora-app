'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MemoryWithDetails, MemoryPhotoRow } from '@/lib/types/database'
import { getSignedPhotoUrl } from '@/lib/storage'
import Icon from '@/components/ui/Icon'

interface LinkedPhoto { ownerName: string; photo: MemoryPhotoRow }

// Photos on LINKED versions of this memory (the friend you tagged saved
// their own copy, or yours is the copy) that you don't have yet, with a
// one-tap "add to mine". Copies are matched by storage basename, which
// survives the copy-on-tag flow, so already-shared photos don't reappear.
export default function LinkedPhotos({ memory, onUpdate }: {
  memory: MemoryWithDetails
  onUpdate: () => void
}) {
  const supabase = createClient()
  const [available, setAvailable] = useState<LinkedPhoto[]>([])
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Linked = my origin (I'm the copy) + copies of mine (I'm the origin)
      const ids: string[] = []
      if (memory.origin_memory_id) ids.push(memory.origin_memory_id)
      const { data: children } = await supabase
        .from('memories').select('id').eq('origin_memory_id', memory.id)
      ids.push(...(children ?? []).map(c => c.id))
      if (ids.length === 0) return

      const { data: linked } = await supabase
        .from('memories')
        .select('id, user_id, memory_photos(*), owner:users!user_id(display_name, memora_id)')
        .in('id', ids)
        .neq('user_id', memory.user_id)
      if (!linked || cancelled) return

      const mine = new Set(memory.memory_photos.map(p => p.storage_path.split('/').pop()))
      const fresh: LinkedPhoto[] = []
      for (const lm of linked) {
        const ownerName = lm.owner?.display_name || lm.owner?.memora_id || 'A friend'
        for (const p of lm.memory_photos ?? []) {
          if (!mine.has(p.storage_path.split('/').pop())) fresh.push({ ownerName, photo: p })
        }
      }
      if (!cancelled) setAvailable(fresh)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memory.id])

  if (available.length === 0) return null

  async function addToMine(entry: LinkedPhoto) {
    if (addingId) return
    setAddingId(entry.photo.id)
    try {
      const base = entry.photo.storage_path.split('/').pop()!
      const dest = `${memory.user_id}/${memory.id}/${base}`
      const { error: ce } = await supabase.storage.from('memory-photos').copy(entry.photo.storage_path, dest)
      if (ce) { alert('Couldn’t add the photo — please try again.'); return }
      await supabase.from('memory_photos').insert({
        memory_id: memory.id, storage_path: dest,
        lat: entry.photo.lat, lng: entry.photo.lng, taken_at: entry.photo.taken_at,
      })
      // The carousel refreshes on next open (parents hold this memory object);
      // dropping the photo from the strip is the immediate feedback.
      setAvailable(prev => prev.filter(x => x.photo.id !== entry.photo.id))
      onUpdate()
    } finally {
      setAddingId(null)
    }
  }

  const names = [...new Set(available.map(a => a.ownerName))].join(', ')

  return (
    <div className="mb-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--stone-200)', borderLeft: '3px solid var(--gold-500)' }}>
      <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--teal-600)' }}>
        <Icon name="image" size={13} color="var(--gold-500)" />
        {names} added {available.length === 1 ? 'a photo' : `${available.length} photos`} you don’t have
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {available.map(entry => (
          <div key={entry.photo.id} className="flex-shrink-0" style={{ width: 72 }}>
            <div className="rounded-xl overflow-hidden" style={{ width: 72, height: 72, background: 'var(--stone-400)' }}>
              <LinkedThumb path={entry.photo.storage_path} />
            </div>
            <button onClick={() => addToMine(entry)} disabled={addingId !== null}
              className="press w-full mt-1 py-1 rounded-lg text-xs font-semibold"
              style={{ background: 'var(--gold-500)', color: '#fff', opacity: addingId === entry.photo.id ? 0.6 : 1 }}>
              {addingId === entry.photo.id ? '…' : '+ Add'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function LinkedThumb({ path }: { path: string }) {
  const supabase = createClient()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    getSignedPhotoUrl(supabase, path).then(u => { if (u) setUrl(u) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])
  if (!url) return <div className="w-full h-full animate-pulse" style={{ background: 'var(--stone-400)' }} />
  return <img src={url} className="w-full h-full" style={{ objectFit: 'cover', display: 'block' }} />
}
