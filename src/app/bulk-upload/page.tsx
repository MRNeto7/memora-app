'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readPhotoExif, fuzzCoordinates } from '@/lib/exif'
import { validateMediaFile } from '@/lib/uploads'
import PlacesSearch from '@/components/memory/PlacesSearch'
import Link from 'next/link'

interface PhotoItem {
  file: File
  preview: string
  lat: number | null
  lng: number | null
  takenAt: Date | null
  name: string
}

interface MemoryGroup {
  id: string
  photos: PhotoItem[]
  suggestedVenue: string
  locationQuery: string
  selectedPlace: { placeId: string; name: string; address: string; lat: number; lng: number } | null
  date: Date
  dishName: string
  notes: string
  confirmed: boolean
  saving: boolean
  saved: boolean
  error: string | null
}

function groupPhotos(photos: PhotoItem[]): MemoryGroup[] {
  // Sort by date
  const sorted = [...photos].sort((a, b) => (a.takenAt?.getTime() ?? 0) - (b.takenAt?.getTime() ?? 0))
  const groups: MemoryGroup[] = []
  let currentGroup: PhotoItem[] = []

  for (let i = 0; i < sorted.length; i++) {
    const photo = sorted[i]
    if (currentGroup.length === 0) {
      currentGroup.push(photo)
    } else {
      const last = currentGroup[currentGroup.length - 1]
      const timeDiff = Math.abs((photo.takenAt?.getTime() ?? 0) - (last.takenAt?.getTime() ?? 0))
      const sameLocation = photo.lat && last.lat
        ? Math.abs(photo.lat - last.lat) < 0.002 && Math.abs((photo.lng ?? 0) - (last.lng ?? 0)) < 0.002
        : true // no location, group by time only
      const withinWindow = timeDiff < 2 * 60 * 60 * 1000 // 2 hours

      if (withinWindow && sameLocation) {
        currentGroup.push(photo)
      } else {
        groups.push(makeGroup(currentGroup))
        currentGroup = [photo]
      }
    }
  }
  if (currentGroup.length > 0) groups.push(makeGroup(currentGroup))
  return groups
}

function makeGroup(photos: PhotoItem[]): MemoryGroup {
  const withDate = photos.filter(p => p.takenAt)
  const date = withDate.length > 0 ? withDate[0].takenAt! : new Date()
  return {
    id: Math.random().toString(36).slice(2),
    photos,
    suggestedVenue: '',
    locationQuery: '',
    selectedPlace: null,
    date,
    dishName: '',
    notes: '',
    confirmed: false,
    saving: false,
    saved: false,
    error: null,
  }
}

export default function BulkUploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const [groups, setGroups] = useState<MemoryGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [untagged, setUntagged] = useState<PhotoItem[]>([])

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setLoading(true)

    const photos: PhotoItem[] = []
    const noLocation: PhotoItem[] = []
    const rejected: string[] = []

    for (const file of files) {
      const reason = await validateMediaFile(file)
      if (reason) { rejected.push(reason); continue }
      const exif = await readPhotoExif(file)
      const item: PhotoItem = {
        file,
        preview: URL.createObjectURL(file),
        lat: exif.lat,
        lng: exif.lng,
        takenAt: exif.takenAt,
        name: file.name,
      }
      if (exif.lat) photos.push(item)
      else noLocation.push(item)
    }

    // Reverse geocode the first photo of each likely group
    const grouped = groupPhotos(photos)

    // Try to get venue suggestions from EXIF coords
    for (const group of grouped) {
      const firstWithLoc = group.photos.find(p => p.lat)
      if (firstWithLoc?.lat && firstWithLoc.lng) {
        try {
          const res = await fetch(`/api/geocode?lat=${firstWithLoc.lat}&lng=${firstWithLoc.lng}`)
          const data = await res.json()
          if (data.name) {
            group.suggestedVenue = data.name
            group.locationQuery = data.name
          }
        } catch { /* silent */ }
      }
    }

    setGroups(grouped)
    setUntagged(noLocation)
    setLoading(false)
    e.target.value = ''
    if (rejected.length > 0) alert(rejected.join('\n'))
  }

  function updateGroup(id: string, updates: Partial<MemoryGroup>) {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g))
  }

  function dismissGroup(id: string) {
    setGroups(prev => prev.filter(g => g.id !== id))
  }

  async function saveGroup(group: MemoryGroup) {
    updateGroup(group.id, { saving: true, error: null })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { updateGroup(group.id, { saving: false, error: 'Not signed in' }); return }

      const place = group.selectedPlace
      const firstPhoto = group.photos.find(p => p.lat)

      // Upsert venue
      let venueId: string | null = null
      const venueName = place?.name ?? group.locationQuery.trim()
      if (venueName) {
        const vData = {
          name: venueName,
          lat: place?.lat ?? firstPhoto?.lat ?? 0,
          lng: place?.lng ?? firstPhoto?.lng ?? 0,
          google_place_id: place?.placeId ?? null,
          address: place?.address ?? null,
        }
        if (place?.placeId) {
          const { data: ev } = await supabase.from('venues').select('id').eq('google_place_id', place.placeId).single()
          if (ev) { venueId = ev.id }
          else { const { data: nv } = await supabase.from('venues').insert(vData).select('id').single(); venueId = nv?.id ?? null }
        } else {
          const { data: nv } = await supabase.from('venues').insert(vData).select('id').single(); venueId = nv?.id ?? null
        }
      }

      const memLat = place?.lat ?? firstPhoto?.lat ?? null
      const memLng = place?.lng ?? firstPhoto?.lng ?? null
      const fuzzed = memLat && memLng ? fuzzCoordinates(memLat, memLng) : null
      const { data: memory, error: me } = await supabase.from('memories').insert({
        user_id: user.id,
        venue_id: venueId,
        dish_name: group.dishName || null,
        notes: group.notes || null,
        is_public: false,
        public_lat: fuzzed?.lat ?? null, public_lng: fuzzed?.lng ?? null,
        visited_at: group.date.toISOString(),
      }).select().single()

      if (me) { updateGroup(group.id, { saving: false, error: me.message }); return }

      for (const photo of group.photos) {
        const ext = photo.file.name.split('.').pop()
        const path = `${user.id}/${memory.id}/${crypto.randomUUID()}.${ext}`
        const { error: ue } = await supabase.storage.from('memory-photos').upload(path, photo.file, { upsert: true })
        if (!ue) await supabase.from('memory_photos').insert({ memory_id: memory.id, storage_path: path, lat: photo.lat, lng: photo.lng, taken_at: photo.takenAt?.toISOString() ?? null })
      }

      updateGroup(group.id, { saved: true, saving: false })
    } catch (err) {
      console.error(err)
      updateGroup(group.id, { saving: false, error: 'Something went wrong' })
    }
  }

  const pending = groups.filter(g => !g.saved)
  const saved = groups.filter(g => g.saved)

  return (
    <div className="min-h-screen" style={{ background: '#EAE5DD', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div className="page-header px-5 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/profile" className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Bulk upload</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Import multiple photos at once</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">

        {groups.length === 0 && !loading && (
          <>
            {/* Upload area */}
            <div
              className="rounded-2xl p-8 flex flex-col items-center text-center cursor-pointer mb-4"
              style={{ background: '#fff', border: '2px dashed #C9A86A' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f5f2ed' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C9A86A" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <p className="font-semibold text-base mb-1" style={{ color: '#0D4F57' }}>Select photos from camera roll</p>
              <p className="text-sm" style={{ color: '#7D878D', maxWidth: 260 }}>Choose multiple food photos — we&apos;ll group them into memories automatically by date and location</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />

            {/* How it works */}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(201,168,106,0.1)', border: '0.5px solid rgba(201,168,106,0.25)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#C9A86A' }}>How bulk upload works</p>
              {[
                'Select as many food photos as you like',
                'We read the date and location from each photo',
                'Photos taken within 2 hours at the same place are grouped as one memory',
                'Confirm each group, add details, and save in seconds',
              ].map(t => (
                <div key={t} className="flex items-start gap-2 mb-1.5">
                  <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#C9A86A' }} />
                  <p className="text-xs" style={{ color: '#7D878D' }}>{t}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {loading && (
          <div className="flex flex-col items-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mb-4" style={{ borderColor: '#0D4F57', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#7D878D' }}>Reading photo metadata…</p>
          </div>
        )}

        {groups.length > 0 && (
          <>
            {/* Summary bar */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: '#0D4F57' }}>
                {pending.length} {pending.length === 1 ? 'group' : 'groups'} to save
                {saved.length > 0 && <span style={{ color: '#7D878D' }}> · {saved.length} saved</span>}
              </p>
              <button onClick={() => fileInputRef.current?.click()}
                className="text-xs px-3 py-1.5 rounded-lg" style={{ background: '#f5f2ed', color: '#7D878D' }}>
                Add more
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />

            {/* Untagged warning */}
            {untagged.length > 0 && (
              <div className="rounded-2xl px-4 py-3 mb-4 text-xs" style={{ background: '#fff9e6', color: '#7a4b0a', borderLeft: '3px solid #C9A86A' }}>
                {untagged.length} photo{untagged.length > 1 ? 's' : ''} had no location data and weren&apos;t grouped — they may have been shared via WhatsApp or another app that strips metadata.
              </div>
            )}

            {/* Groups */}
            <div className="flex flex-col gap-4">
              {groups.map(group => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onUpdate={updates => updateGroup(group.id, updates)}
                  onSave={() => saveGroup(group)}
                  onDismiss={() => dismissGroup(group.id)}
                />
              ))}
            </div>

            {pending.length === 0 && saved.length > 0 && (
              <div className="mt-4 rounded-2xl p-5 text-center" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
                <p className="text-2xl mb-2">🎉</p>
                <p className="font-semibold" style={{ color: '#0D4F57' }}>All done!</p>
                <p className="text-sm mt-1 mb-4" style={{ color: '#7D878D' }}>{saved.length} {saved.length === 1 ? 'memory' : 'memories'} saved to your map</p>
                <Link href="/" className="inline-block px-6 py-3 rounded-2xl text-sm font-semibold no-underline" style={{ background: '#0D4F57', color: '#EAE5DD' }}>
                  View on map
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function GroupCard({ group, onUpdate, onSave, onDismiss }: {
  group: MemoryGroup
  onUpdate: (u: Partial<MemoryGroup>) => void
  onSave: () => void
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  if (group.saved) {
    return (
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: '#f0faf4', border: '1px solid rgba(13,79,87,0.15)' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#0D4F57' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#0D4F57' }}>{(group.selectedPlace?.name ?? group.locationQuery) || 'Memory'} saved</p>
          <p className="text-xs" style={{ color: '#7D878D' }}>{group.photos.length} photo{group.photos.length > 1 ? 's' : ''} · {group.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.1)' }}>
      {/* Photo strip */}
      <div className="flex gap-1 p-2 overflow-x-auto">
        {group.photos.slice(0, 6).map((photo, i) => (
          <div key={i} className="relative flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 72, height: 72 }}>
            <img src={photo.preview} className="w-full h-full object-cover" />
          </div>
        ))}
        {group.photos.length > 6 && (
          <div className="flex-shrink-0 rounded-xl flex items-center justify-center" style={{ width: 72, height: 72, background: '#f5f2ed' }}>
            <span className="text-xs font-semibold" style={{ color: '#7D878D' }}>+{group.photos.length - 6}</span>
          </div>
        )}
      </div>

      <div className="px-4 pb-2">
        {/* Date + count */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold" style={{ color: '#0D4F57' }}>
              {group.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p className="text-xs" style={{ color: '#7D878D' }}>{group.photos.length} photo{group.photos.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#f5f2ed', color: '#7D878D' }}>
            {expanded ? 'Collapse' : 'Edit'}
          </button>
        </div>

        {expanded && (
          <>
            {/* Location */}
            <div className="mb-3">
              <PlacesSearch
                value={group.locationQuery}
                onChange={v => onUpdate({ locationQuery: v, selectedPlace: null })}
                onSelect={p => onUpdate({ selectedPlace: p, locationQuery: p.name })}
                selectedPlace={group.selectedPlace}
              />
            </div>

            {/* Dish */}
            <div className="mb-3">
              <label className="text-xs font-medium block mb-1" style={{ color: '#7D878D' }}>Dish <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <input type="text" value={group.dishName} onChange={e => onUpdate({ dishName: e.target.value })}
                placeholder="What did you have?"
                className="w-full text-sm px-3 py-2 rounded-xl outline-none"
                style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
            </div>

            {/* Notes */}
            <div className="mb-3">
              <label className="text-xs font-medium block mb-1" style={{ color: '#7D878D' }}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <input type="text" value={group.notes} onChange={e => onUpdate({ notes: e.target.value })}
                placeholder="Quick thought…"
                className="w-full text-sm px-3 py-2 rounded-xl outline-none"
                style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
            </div>
          </>
        )}

        {group.error && <p className="text-xs mb-2" style={{ color: '#a32d2d' }}>{group.error}</p>}

        {/* Actions */}
        <div className="flex gap-2 pb-1">
          <button onClick={onSave} disabled={group.saving || !group.locationQuery.trim()}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
            style={{ background: '#0D4F57', color: '#EAE5DD', opacity: group.saving || !group.locationQuery.trim() ? 0.5 : 1 }}>
            {group.saving ? 'Saving…' : '✓ Save memory'}
          </button>
          <button onClick={onDismiss}
            className="px-3 py-2.5 rounded-xl text-xs font-medium"
            style={{ background: '#f5f2ed', color: '#7D878D' }}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
