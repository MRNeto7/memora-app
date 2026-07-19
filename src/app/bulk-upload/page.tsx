'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { readPhotoExif, fuzzCoordinates } from '@/lib/exif'
import { validateMediaFile, uploadPhotoWithThumb } from '@/lib/uploads'
import { calcOverall, DetailRatings } from '@/lib/ratings'
import { useIsPro, FREE_BULK_LIMIT } from '@/lib/pro'
import RatingSliders from '@/components/ui/RatingSliders'
import CategoryPicker from '@/components/ui/CategoryPicker'
import { VenueType, MealType, mealTypeFromDate } from '@/lib/categories'
import Icon from '@/components/ui/Icon'
import ProUpsell from '@/components/pro/ProUpsell'
import Portal from '@/components/ui/Portal'
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
  ratings: DetailRatings
  venueType: VenueType | null
  mealType: MealType | null
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
    ratings: { food: 0, service: 0, ambiance: 0 },
    venueType: null,
    mealType: mealTypeFromDate(date),
    confirmed: false,
    saving: false,
    saved: false,
    error: null,
  }
}

export default function BulkUploadPage() {
  const supabase = createClient()
  const isPro = useIsPro()
  const [groups, setGroups] = useState<MemoryGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [untagged, setUntagged] = useState<PhotoItem[]>([])
  // Feedback for the silent gap while iOS copies the selection (iCloud photos
  // can take several seconds before the change event fires).
  const [pickerWaiting, setPickerWaiting] = useState(false)
  const [freeCapped, setFreeCapped] = useState<number | null>(null)
  const pickerArmed = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const waitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Release preview blobs when leaving the page — a 100-photo import
  // otherwise holds ~hundreds of MB of decoded image data in memory.
  useEffect(() => {
    return () => {
      setGroups(prev => { prev.forEach(g => g.photos.forEach(p => URL.revokeObjectURL(p.preview))); return prev })
      setUntagged(prev => { prev.forEach(p => URL.revokeObjectURL(p.preview)); return prev })
    }
  }, [])

  useEffect(() => {
    function onFocus() {
      if (!pickerArmed.current) return
      // Picker just dismissed — files may still be transferring. Show feedback
      // until change/cancel fires, with a failsafe so it can't get stuck.
      setPickerWaiting(true)
      if (waitTimeout.current) clearTimeout(waitTimeout.current)
      waitTimeout.current = setTimeout(() => { pickerArmed.current = false; setPickerWaiting(false) }, 30000)
    }
    function clearWaiting() {
      pickerArmed.current = false
      if (waitTimeout.current) clearTimeout(waitTimeout.current)
      setPickerWaiting(false)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const input = fileInputRef.current
    input?.addEventListener('cancel', clearWaiting)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      input?.removeEventListener('cancel', clearWaiting)
      if (waitTimeout.current) clearTimeout(waitTimeout.current)
    }
  }, [])

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    pickerArmed.current = false
    if (waitTimeout.current) clearTimeout(waitTimeout.current)
    setPickerWaiting(false)
    let files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-selecting the same photos later
    if (!files.length) return
    // Free tier: cap each bulk import, but load the first batch rather than block
    if (isPro === false && files.length > FREE_BULK_LIMIT) {
      setFreeCapped(files.length)
      files = files.slice(0, FREE_BULK_LIMIT)
    } else {
      setFreeCapped(null)
    }
    processFiles(files)
  }

  async function processFiles(files: File[]) {
    setLoading(true)
    setProgress({ done: 0, total: files.length })
    // Let the loading overlay actually paint before we hog the main thread
    // with EXIF parsing — otherwise the screen freezes with no feedback.
    await new Promise(r => setTimeout(r, 60))

    const photos: PhotoItem[] = []
    const noLocation: PhotoItem[] = []
    const rejected: string[] = []
    let done = 0

    // Read metadata a few photos at a time so a large batch finishes quickly,
    // updating the progress counter as each one completes.
    const CONCURRENCY = 6
    let cursor = 0
    async function worker() {
      while (cursor < files.length) {
        const file = files[cursor++]
        const reason = await validateMediaFile(file)
        if (reason) {
          rejected.push(reason)
        } else {
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
        done++
        setProgress({ done, total: files.length })
        // Yield a macrotask so the progress bar repaints as it climbs
        await new Promise(r => setTimeout(r, 0))
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker))

    // Grouping + geocoding phase
    setProgress(null)
    const grouped = groupPhotos([...photos, ...noLocation])

    // Venue suggestions from EXIF coords — all groups in parallel
    await Promise.all(grouped.map(async group => {
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
    }))

    // Append so "Add more" never wipes details already entered
    setGroups(prev => [...prev, ...grouped])
    setUntagged(prev => [...prev, ...noLocation])
    setLoading(false)
    if (rejected.length > 0) toast(rejected[0] + (rejected.length > 1 ? ` (+${rejected.length - 1} more)` : ''), 'error')
  }

  function updateGroup(id: string, updates: Partial<MemoryGroup>) {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g))
  }

  function dismissGroup(id: string) {
    setGroups(prev => {
      const target = prev.find(g => g.id === id)
      target?.photos.forEach(p => URL.revokeObjectURL(p.preview))
      return prev.filter(g => g.id !== id)
    })
  }

  // Pull one photo out of a group into its own new memory (for when the
  // auto-grouping lumped together photos that belong to separate visits).
  function splitPhoto(groupId: string, photoIndex: number) {
    setGroups(prev => {
      const idx = prev.findIndex(g => g.id === groupId)
      if (idx === -1) return prev
      const group = prev[idx]
      if (group.photos.length <= 1) return prev
      const photo = group.photos[photoIndex]
      const next = [...prev]
      next[idx] = { ...group, photos: group.photos.filter((_, i) => i !== photoIndex) }
      next.splice(idx + 1, 0, makeGroup([photo]))
      return next
    })
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
      const overall = calcOverall(group.ratings)
      const { data: memory, error: me } = await supabase.from('memories').insert({
        user_id: user.id,
        venue_id: venueId,
        dish_name: group.dishName || null,
        notes: group.notes || null,
        rating: overall > 0 ? overall : null,
        rating_food: group.ratings.food || null,
        rating_service: group.ratings.service || null,
        rating_ambiance: group.ratings.ambiance || null,
        venue_type: group.venueType,
        meal_type: group.mealType,
        is_public: false,
        public_lat: fuzzed?.lat ?? null, public_lng: fuzzed?.lng ?? null,
        visited_at: group.date.toISOString(),
      }).select().single()

      if (me) { updateGroup(group.id, { saving: false, error: me.message }); return }

      // Compress + upload in batches of 3 — parallel enough to be fast,
      // small enough to not spike memory on phones
      let uploaded = 0
      for (let i = 0; i < group.photos.length; i += 3) {
        const batch = group.photos.slice(i, i + 3)
        const results = await Promise.all(batch.map(async photo => {
          try {
            const path = await uploadPhotoWithThumb(supabase, user.id, memory.id, photo.file)
            if (!path) return false
            await supabase.from('memory_photos').insert({ memory_id: memory.id, storage_path: path, lat: photo.lat, lng: photo.lng, taken_at: photo.takenAt?.toISOString() ?? null })
            return true
          } catch { return false }
        }))
        uploaded += results.filter(Boolean).length
      }

      const failed = group.photos.length - uploaded
      updateGroup(group.id, {
        saved: true,
        saving: false,
        error: failed > 0 ? `${failed} photo${failed > 1 ? 's' : ''} failed to upload` : null,
      })
    } catch (err) {
      console.error(err)
      updateGroup(group.id, { saving: false, error: 'Something went wrong' })
    }
  }

  const pending = groups.filter(g => !g.saved)
  const saved = groups.filter(g => g.saved)
  const ready = pending.filter(g => g.locationQuery.trim() && !g.saving)
  const [savingAll, setSavingAll] = useState(false)
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null)

  async function saveAll() {
    const toSave = ready
    setSavingAll(true)
    setSaveProgress({ done: 0, total: toSave.length })
    let done = 0
    for (const group of toSave) {
      await saveGroup(group)
      done++
      setSaveProgress({ done, total: toSave.length })
    }
    setSavingAll(false)
    setSaveProgress(null)
  }

  return (
    <div className="page-enter min-h-screen" style={{ background: 'var(--stone-400)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div className="page-header px-5 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/profile" className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--stone-200)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16191B" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Bulk upload</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--slate)' }}>Import multiple photos at once</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">

        {isPro === null && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--teal-600)', borderTopColor: 'transparent' }} />
          </div>
        )}

        {isPro !== null && groups.length === 0 && !loading && (
          <>
            {/* Upload area — the input is tapped directly via the label;
                a JS .click() on a file input is unreliable in the Capacitor WebView */}
            <label
              htmlFor="bulk-file-input"
              className="rounded-2xl p-8 flex flex-col items-center text-center cursor-pointer mb-4"
              style={{ background: '#fff', border: '2px dashed var(--gold-500)' }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--stone-200)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C9A86A" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <p className="font-semibold text-base mb-1" style={{ color: 'var(--teal-600)' }}>Select photos from camera roll</p>
              <p className="text-sm" style={{ color: 'var(--slate)', maxWidth: 260 }}>Choose multiple food photos — we&apos;ll group them into memories automatically by date and location</p>
              {isPro === false && (
                <p className="text-xs mt-2 px-3 py-1 rounded-full" style={{ background: 'rgba(201,168,106,0.12)', color: 'var(--gold-700)' }}>
                  Free includes {FREE_BULK_LIMIT} photos per import · Pro is unlimited
                </p>
              )}
            </label>

            {/* How it works */}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(201,168,106,0.1)', border: '0.5px solid rgba(201,168,106,0.25)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--gold-500)' }}>How bulk upload works</p>
              {[
                'Select as many food photos as you like',
                'We read the date and location from each photo',
                'Photos taken within 2 hours at the same place are grouped as one memory',
                'Confirm each group, add details, and save in seconds',
              ].map(t => (
                <div key={t} className="flex items-start gap-2 mb-1.5">
                  <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--gold-500)' }} />
                  <p className="text-xs" style={{ color: 'var(--slate)' }}>{t}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* One shared input for both entry points; onClick arms the transfer feedback */}
        <input
          id="bulk-file-input"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onClick={() => { pickerArmed.current = true }}
          onChange={handleFilesSelected}
        />

        {pickerWaiting && !loading && (
          <Portal>
            <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: 'rgba(16,20,22,0.45)', backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)' }}>
              <div className="rounded-3xl px-8 py-7 flex flex-col items-center" style={{ background: '#fff', width: 'min(300px, 85%)', boxShadow: '0 16px 48px rgba(0,0,0,0.28)' }}>
                <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mb-4" style={{ borderColor: 'var(--teal-600)', borderTopColor: 'transparent' }} />
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--teal-600)' }}>Preparing your photos…</p>
                <p className="text-xs text-center mb-4" style={{ color: 'var(--slate)' }}>Large selections and iCloud photos can take a few seconds</p>
                <button onClick={() => { pickerArmed.current = false; setPickerWaiting(false) }}
                  className="text-xs px-4 py-2 rounded-xl" style={{ background: 'var(--stone-200)', color: 'var(--slate)' }}>
                  Cancel
                </button>
              </div>
            </div>
          </Portal>
        )}

        {loading && (
          <Portal>
            <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: 'rgba(16,20,22,0.45)', backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)' }}>
              <div className="rounded-3xl px-8 py-7 flex flex-col items-center" style={{ background: '#fff', width: 'min(300px, 85%)', boxShadow: '0 16px 48px rgba(0,0,0,0.28)' }}>
                <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mb-4" style={{ borderColor: 'var(--teal-600)', borderTopColor: 'transparent' }} />
                {progress ? (
                  <>
                    <p className="text-sm font-semibold mb-2.5" style={{ color: 'var(--teal-600)' }}>Reading photos… {progress.done} of {progress.total}</p>
                    <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: '#e5ded3' }}>
                      <div style={{ width: `${Math.round((progress.done / progress.total) * 100)}%`, height: '100%', background: 'var(--gold-500)', transition: 'width 0.25s ease' }} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--slate)' }}>Grouping your photos…</p>
                )}
              </div>
            </div>
          </Portal>
        )}

        {groups.length > 0 && (
          <>
            {freeCapped !== null && (
              <div className="rounded-2xl px-4 py-3 mb-4 flex items-start gap-3" style={{ background: 'rgba(201,168,106,0.1)', border: '0.5px solid rgba(201,168,106,0.3)' }}>
                <Icon name="sparkle" size={16} color="#C9A86A" strokeWidth={1.8} />
                <div className="flex-1">
                  <p className="text-xs font-semibold mb-0.5" style={{ color: '#a8863e' }}>
                    First {FREE_BULK_LIMIT} of {freeCapped} photos loaded
                  </p>
                  <p className="text-xs" style={{ color: 'var(--slate)' }}>
                    Free includes {FREE_BULK_LIMIT} photos per import — Mimora Pro imports your whole camera roll at once.
                  </p>
                </div>
                <button onClick={() => setFreeCapped(null)} className="flex-shrink-0" style={{ color: '#b0babe', fontSize: 14, lineHeight: 1 }}>✕</button>
              </div>
            )}
            {/* Summary bar */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: 'var(--teal-600)' }}>
                {pending.length} {pending.length === 1 ? 'group' : 'groups'} to save
                {saved.length > 0 && <span style={{ color: 'var(--slate)' }}> · {saved.length} saved</span>}
              </p>
              <div className="flex gap-2">
                <label htmlFor="bulk-file-input" className="text-xs px-3 py-1.5 rounded-lg cursor-pointer flex items-center" style={{ background: 'var(--stone-200)', color: 'var(--slate)' }}>
                  Add more
                </label>
                {ready.length > 1 && (
                  <button onClick={saveAll} disabled={savingAll}
                    className="press text-xs px-3 py-1.5 rounded-lg font-semibold"
                    style={{ background: 'var(--stone-200)', color: 'var(--teal-600)', opacity: savingAll ? 0.6 : 1 }}>
                    {savingAll ? (saveProgress ? `Saving ${saveProgress.done} of ${saveProgress.total}…` : 'Saving…') : `Save all (${ready.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Untagged warning */}
            {untagged.length > 0 && (
              <div className="rounded-2xl px-4 py-3 mb-4 text-xs" style={{ background: '#fff9e6', color: '#7a4b0a', borderLeft: '3px solid var(--gold-500)' }}>
                {untagged.length} photo{untagged.length > 1 ? 's' : ''} had no location data (often stripped by WhatsApp or screenshots) — they&apos;re grouped by time below, just type the location in.
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
                  onSplit={i => splitPhoto(group.id, i)}
                />
              ))}
            </div>

            {pending.length === 0 && saved.length > 0 && (
              <div className="mt-4 rounded-2xl p-5 flex flex-col items-center text-center" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(16,20,22,0.06)' }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--stone-200)' }}>
                  <Icon name="check" size={20} color="var(--gold-500)" strokeWidth={2.5} />
                </div>
                <p className="font-semibold" style={{ color: 'var(--teal-600)' }}>All done!</p>
                <p className="text-sm mt-1 mb-4" style={{ color: 'var(--slate)' }}>{saved.length} {saved.length === 1 ? 'memory' : 'memories'} saved to your map</p>
                <Link href="/" className="inline-block px-6 py-3 rounded-2xl text-sm font-semibold no-underline" style={{ background: 'var(--stone-200)', color: 'var(--teal-600)' }}>
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

function GroupCard({ group, onUpdate, onSave, onDismiss, onSplit }: {
  group: MemoryGroup
  onUpdate: (u: Partial<MemoryGroup>) => void
  onSave: () => void
  onDismiss: () => void
  onSplit: (photoIndex: number) => void
}) {
  const [expanded, setExpanded] = useState(true)

  if (group.saved) {
    return (
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: '#f0faf4', border: '1px solid rgba(16,20,22,0.15)' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--stone-200)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--teal-600)' }}>{(group.selectedPlace?.name ?? group.locationQuery) || 'Memory'} saved</p>
          <p className="text-xs" style={{ color: 'var(--slate)' }}>{group.photos.length} photo{group.photos.length > 1 ? 's' : ''} · {group.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
          {group.error && <p className="text-xs mt-0.5" style={{ color: 'var(--danger)' }}>{group.error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(16,20,22,0.06)' }}>
      {/* Photo strip */}
      <div className="flex gap-1 p-2 overflow-x-auto">
        {group.photos.slice(0, 6).map((photo, i) => (
          <div key={i} className="relative flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 72, height: 72 }}>
            <img src={photo.preview} className="w-full h-full object-cover" />
            {group.photos.length > 1 && (
              <button onClick={() => onSplit(i)} title="Move to its own memory"
                className="absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.55)' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3l-7 7M21 9V3h-6M3 21l7-7M3 15v6h6"/></svg>
              </button>
            )}
          </div>
        ))}
        {group.photos.length > 6 && (
          <div className="flex-shrink-0 rounded-xl flex items-center justify-center" style={{ width: 72, height: 72, background: 'var(--stone-200)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--slate)' }}>+{group.photos.length - 6}</span>
          </div>
        )}
      </div>

      {group.photos.length > 1 && (
        <p className="px-3 -mt-0.5 mb-1 text-xs" style={{ color: 'var(--slate-light)' }}>Wrong group? Tap the ⤢ on a photo to move it to its own memory.</p>
      )}

      <div className="px-4 pb-2">
        {/* Date + count */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--teal-600)' }}>
              {group.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p className="text-xs" style={{ color: 'var(--slate)' }}>{group.photos.length} photo{group.photos.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--stone-200)', color: 'var(--slate)' }}>
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
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--slate)' }}>Dish <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <input type="text" value={group.dishName} onChange={e => onUpdate({ dishName: e.target.value })}
                placeholder="What did you have?"
                className="w-full text-sm px-3 py-2 rounded-xl outline-none"
                style={{ border: '1.5px solid var(--stone-500)', background: 'var(--stone-100)' }} />
            </div>

            {/* Ratings */}
            <div className="mb-3 rounded-xl p-3" style={{ background: 'var(--stone-200)' }}>
              <div className="mb-3">
                <CategoryPicker compact venueType={group.venueType} mealType={group.mealType}
                  onVenueType={v => onUpdate({ venueType: v })} onMealType={m => onUpdate({ mealType: m })} />
              </div>
              <RatingSliders ratings={group.ratings} onChange={r => onUpdate({ ratings: r })} title="Rate it (optional)" />
            </div>

            {/* Notes */}
            <div className="mb-3">
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--slate)' }}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <input type="text" value={group.notes} onChange={e => onUpdate({ notes: e.target.value })}
                placeholder="Quick thought…"
                className="w-full text-sm px-3 py-2 rounded-xl outline-none"
                style={{ border: '1.5px solid var(--stone-500)', background: 'var(--stone-100)' }} />
            </div>
          </>
        )}

        {group.error && <p className="text-xs mb-2" style={{ color: 'var(--danger)' }}>{group.error}</p>}

        {/* Actions */}
        <div className="flex gap-2 pb-1">
          <button onClick={onSave} disabled={group.saving || !group.locationQuery.trim()}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
            style={{ background: 'var(--stone-200)', color: 'var(--teal-600)', opacity: group.saving || !group.locationQuery.trim() ? 0.5 : 1 }}>
            {group.saving ? 'Saving…' : '✓ Save memory'}
          </button>
          <button onClick={onDismiss}
            className="px-3 py-2.5 rounded-xl text-xs font-medium"
            style={{ background: 'var(--stone-200)', color: 'var(--slate)' }}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
