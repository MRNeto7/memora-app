'use client'

import { useState, useRef, useEffect } from 'react'
import { MemoryWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { readPhotoExif, getExifMessage, fuzzCoordinates } from '@/lib/exif'
import { getSignedPhotoUrl } from '@/lib/storage'
import { filterMediaFiles } from '@/lib/uploads'
import { compressImage } from '@/lib/images'
import { calcOverall, DetailRatings } from '@/lib/ratings'
import { useIsPro, checkMemoryAllowance, FREE_PHOTOS_PER_MEMORY } from '@/lib/pro'
import RatingSliders from '@/components/ui/RatingSliders'
import Icon from '@/components/ui/Icon'
import Portal from '@/components/ui/Portal'
import PlacesSearch from './PlacesSearch'
import Lightbox from '@/components/media/Lightbox'

interface PlaceSuggestion {
  placeId: string; name: string; address: string; lat: number; lng: number; rating?: number
}
interface PhotoEntry {
  file: File; preview: string; lat: number | null; lng: number | null; takenAt: Date | null; exifMessage: string | null
}
interface MemorySheetProps {
  memory: MemoryWithDetails | null
  onClose: () => void
  onUpdate: () => void
}

export default function MemorySheet({ memory, onClose, onUpdate }: MemorySheetProps) {
  const isNew = !memory
  const supabase = createClient()
  const isPro = useIsPro()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [dishName, setDishName] = useState(memory?.dish_name ?? '')
  const [notes, setNotes] = useState(memory?.notes ?? '')
  const [detailRatings, setDetailRatings] = useState<DetailRatings>({ food: 0, service: 0, ambiance: 0 })
  const [locationQuery, setLocationQuery] = useState(memory?.venue?.name ?? '')
  const [locationName, setLocationName] = useState(memory?.venue?.name ?? '')
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null)
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [detectedLat, setDetectedLat] = useState<number | null>(null)
  const [detectedLng, setDetectedLng] = useState<number | null>(null)
  const [detectedDate, setDetectedDate] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  void debounceRef

  const overall = calcOverall(detailRatings)

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const { accepted: allAccepted, rejected } = await filterMediaFiles(files, {
      allowVideo: isPro === true,
      videoRejectionMessage: 'Video memories are part of Mimora Pro — coming soon.',
    })
    let accepted = allAccepted
    if (isPro !== true && photos.length + accepted.length > FREE_PHOTOS_PER_MEMORY) {
      accepted = accepted.slice(0, Math.max(0, FREE_PHOTOS_PER_MEMORY - photos.length))
      rejected.push(`Free plan includes ${FREE_PHOTOS_PER_MEMORY} photos per memory — Mimora Pro (coming soon) unlocks unlimited photos.`)
    }
    if (rejected.length > 0) alert(rejected.join('\n'))
    const newPhotos: PhotoEntry[] = []

    for (const file of accepted) {
      const exif = await readPhotoExif(file)
      newPhotos.push({
        file,
        preview: URL.createObjectURL(file),
        lat: exif.lat, lng: exif.lng,
        takenAt: exif.takenAt,
        exifMessage: getExifMessage(exif),
      })
      if (exif.lat && exif.lng && !detectedLat) { setDetectedLat(exif.lat); setDetectedLng(exif.lng) }
      if (exif.takenAt && !detectedDate) setDetectedDate(exif.takenAt)
    }

    setPhotos(prev => [...prev, ...newPhotos])
    e.target.value = ''
  }

  async function handleSave() {
    setSaveError(null)
    if (!locationName.trim()) { setSaveError('Please add a location.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaveError('You need to be signed in.'); setSaving(false); return }

      const allowanceError = await checkMemoryAllowance(supabase, user.id, isPro)
      if (allowanceError) { setSaveError(allowanceError); setSaving(false); return }

      let venueId: string | null = null
      const venueData = { name: locationName.trim(), lat: selectedPlace?.lat ?? detectedLat ?? 0, lng: selectedPlace?.lng ?? detectedLng ?? 0, google_place_id: selectedPlace?.placeId ?? null, address: selectedPlace?.address ?? null }
      if (selectedPlace?.placeId) {
        const { data: ev } = await supabase.from('venues').select('id').eq('google_place_id', selectedPlace.placeId).single()
        if (ev) { venueId = ev.id } else { const { data: nv } = await supabase.from('venues').insert(venueData).select('id').single(); venueId = nv?.id ?? null }
      } else { const { data: nv } = await supabase.from('venues').insert(venueData).select('id').single(); venueId = nv?.id ?? null }

      const fuzzed = venueData.lat && venueData.lng ? fuzzCoordinates(venueData.lat, venueData.lng) : null
      const { data: newMemory, error: me } = await supabase.from('memories').insert({
        user_id: user.id, venue_id: venueId, dish_name: dishName || null, notes: notes || null,
        rating: overall > 0 ? overall : null,
        rating_food: detailRatings.food || null,
        rating_service: detailRatings.service || null,
        rating_ambiance: detailRatings.ambiance || null,
        is_public: false,
        public_lat: fuzzed?.lat ?? null, public_lng: fuzzed?.lng ?? null,
        visited_at: detectedDate?.toISOString() ?? new Date().toISOString(),
      }).select().single()

      if (me) { setSaveError(`Error: ${me.message}`); setSaving(false); return }

      // Optimistic: the memory row is saved — close the sheet now and let
      // photos compress + upload in the background, refreshing again when
      // they land. Capture what the closure needs; the component unmounts.
      const pending = [...photos]
      const userId = user.id
      const memoryId = newMemory.id
      onUpdate()
      if (pending.length > 0) {
        void (async () => {
          let failed = 0
          for (const photo of pending) {
            try {
              const upload = await compressImage(photo.file)
              const ext = upload.name.split('.').pop()
              const path = `${userId}/${memoryId}/${crypto.randomUUID()}.${ext}`
              const { error: ue } = await supabase.storage.from('memory-photos').upload(path, upload, { upsert: true, contentType: upload.type })
              if (ue) { failed++; continue }
              await supabase.from('memory_photos').insert({ memory_id: memoryId, storage_path: path, lat: photo.lat, lng: photo.lng, taken_at: photo.takenAt?.toISOString() ?? null })
            } catch { failed++ }
          }
          if (failed > 0) alert(`${failed === 1 ? 'A photo' : `${failed} photos`} didn't upload — open the memory and try adding ${failed === 1 ? 'it' : 'them'} again.`)
          onUpdate()
        })()
      }
    } catch (err) { console.error(err); setSaveError('Something went wrong.') }
    finally { setSaving(false) }
  }

  const displayDate = detectedDate ?? (memory?.visited_at ? new Date(memory.visited_at) : new Date())
  const exifMessages = [...new Set(photos.map(p => p.exifMessage).filter(Boolean))]

  return (
    <Portal>
      {/* Backdrop */}
      <div className="backdrop-enter fixed z-[60]" style={{ top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(13,79,87,0.4)', backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)' }} onClick={onClose} />

      {/* Centred modal card */}
      <div className="fixed z-[70] flex items-start justify-center pointer-events-none" style={{ top: 0, left: 0, right: 0, bottom: 0, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
      <div className="sheet-enter glass-modal relative w-full rounded-3xl overflow-hidden flex flex-col pointer-events-auto"
        style={{ maxHeight: '82vh', width: 'min(420px, 100%)' }}>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── VIEW MODE ── */}
          {!isNew && (
            <>
              <div className="flex items-center justify-end px-4 pt-3 pb-1 flex-shrink-0">
                <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(13,79,87,0.08)', color: '#7D878D', fontSize: 14 }}>✕</button>
              </div>
              <MemoryDetailView memory={memory} onUpdate={onUpdate} />
            </>
          )}

          {/* ── ADD MODE ── */}
          {isNew && (
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base" style={{ color: '#0D4F57' }}>Save a memory</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(13,79,87,0.08)', color: '#7D878D', fontSize: 14 }}>✕</button>
            </div>

              {/* Photos */}
              <div className="mb-4">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((p, i) => (
                    <div key={i} className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
                      <img src={p.preview} className="w-full h-full object-cover rounded-xl" />
                      <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white"
                        style={{ background: 'rgba(0,0,0,0.5)', fontSize: 10 }}>✕</button>
                    </div>
                  ))}
                  <label className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl cursor-pointer"
                    style={{ width: photos.length === 0 ? '100%' : 80, height: 80, background: '#f5f2ed', border: '2px dashed #C9A86A' }}>
                    <Icon name="camera" size={photos.length === 0 ? 24 : 18} color="#C9A86A" />
                    <span className="text-xs mt-1 text-center px-1" style={{ color: '#C9A86A', lineHeight: 1.3 }}>{photos.length === 0 ? 'Photos & videos' : '+'}</span>
                    <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handlePhotoSelect} />
                  </label>
                </div>
              </div>

              {exifMessages.map((msg, i) => (
                <div key={i} className="rounded-xl px-3 py-2.5 mb-3 text-xs leading-relaxed" style={{ background: '#fff9e6', color: '#7a4b0a', borderLeft: '3px solid #C9A86A' }}>{msg}</div>
              ))}

              <div className="flex gap-2 mb-4 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full" style={{ background: '#f0ede8', color: '#0D4F57' }}>
                  <Icon name="clock" size={12} color="#0D4F57" />
                  {displayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {detectedDate && <span className="ml-1 opacity-60">auto</span>}
                </span>
              </div>

              <div className="mb-3">
                <PlacesSearch value={locationQuery}
                  onChange={(v) => { setLocationQuery(v); setLocationName(v); setSelectedPlace(null) }}
                  onSelect={(p) => { setSelectedPlace(p); setLocationName(p.name); setLocationQuery(p.name); setDetectedLat(p.lat); setDetectedLng(p.lng) }}
                  selectedPlace={selectedPlace} />
              </div>

              <div className="mb-3">
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>Dish <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input type="text" placeholder="e.g. Truffle pasta" value={dishName} onChange={e => setDishName(e.target.value)}
                  className="w-full text-sm px-4 py-2.5 rounded-xl outline-none" style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
              </div>

              <div className="mb-4 rounded-2xl p-4" style={{ background: '#f5f2ed' }}>
                <RatingSliders ratings={detailRatings} onChange={setDetailRatings} />
              </div>

              <div className="mb-4">
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <textarea placeholder="What made it special?" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full text-sm px-4 py-2.5 rounded-xl outline-none resize-none" style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
              </div>

              {saveError && <div className="rounded-xl px-4 py-3 mb-3 text-sm" style={{ background: 'rgba(163,45,45,0.08)', color: '#a32d2d' }}>{saveError}</div>}
            </div>
          )}
        </div>

        {/* Sticky footer for add mode */}
        {isNew && (
          <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: '0.5px solid rgba(13,79,87,0.08)' }}>
            <button onClick={handleSave} disabled={saving || !locationName.trim()}
              className="press w-full py-3.5 rounded-2xl text-white font-semibold text-sm"
              style={{ background: '#0D4F57', opacity: saving || !locationName.trim() ? 0.5 : 1 }}>
              {saving ? 'Saving…' : '✓ Save memory'}
            </button>
          </div>
        )}
      </div>
    </div>
    </Portal>
  )
}

// ── Star display ──
function StarRow({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2, lineHeight: 1 }}>
      {Array.from({ length: max }, (_, i) => {
        const fill = Math.min(Math.max(value - i, 0), 1) * 100
        return (
          <div key={i} style={{ position: 'relative', width: 16, height: 16, flexShrink: 0 }}>
            {/* Grey base */}
            <span style={{ position: 'absolute', inset: 0, fontSize: 16, lineHeight: '16px', color: '#d4cdc3' }}>★</span>
            {/* Gold fill — clip with overflow hidden */}
            <span style={{ position: 'absolute', inset: 0, fontSize: 16, lineHeight: '16px', color: '#C9A86A', overflow: 'hidden', width: `${fill}%`, whiteSpace: 'nowrap' }}>★</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Rich memory detail view ──
interface VenueDetails { website: string | null; phone: string | null; openNow: boolean | null; rating: number | null; totalRatings: number | null; priceLevel: number | null }

function MemoryDetailView({ memory, onUpdate }: { memory: MemoryWithDetails; onUpdate: () => void }) {
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [venueDetails, setVenueDetails] = useState<VenueDetails | null>(null)
  const [editing, setEditing] = useState(false)
  const supabase = createClient()

  const [editDish, setEditDish] = useState(memory.dish_name ?? '')
  const [editNotes, setEditNotes] = useState(memory.notes ?? '')
  // Start from the stored category ratings so editing doesn't wipe them
  const [editRatings, setEditRatings] = useState<DetailRatings>({
    food: memory.rating_food ?? 0,
    service: memory.rating_service ?? 0,
    ambiance: memory.rating_ambiance ?? 0,
  })
  // Optimistic edits — applied to the view immediately, reverted on failure.
  // Also keeps the open sheet current: parents refetch the list on update
  // but never refresh the `memory` object they're holding.
  const [overrides, setOverrides] = useState<Partial<MemoryWithDetails>>({})
  const shown = { ...memory, ...overrides }

  useEffect(() => {
    if (memory.venue?.google_place_id) {
      fetch(`/api/venue-details?placeId=${memory.venue.google_place_id}`)
        .then(r => r.json()).then(setVenueDetails).catch(() => {})
    }
  }, [memory.venue?.google_place_id])

  function handleSaveEdit() {
    const overall = calcOverall(editRatings)
    const patch = {
      dish_name: editDish || null,
      notes: editNotes || null,
      rating: overall > 0 ? overall : memory.rating,
      rating_food: editRatings.food || null,
      rating_service: editRatings.service || null,
      rating_ambiance: editRatings.ambiance || null,
    }
    // Optimistic: show the edits immediately, revert if the write fails
    const previous = overrides
    setOverrides(o => ({ ...o, ...patch }))
    setEditing(false)
    supabase.from('memories').update(patch).eq('id', memory.id).then(({ error }) => {
      if (error) { setOverrides(previous); alert('Couldn’t save your edits — please try again.') }
      else onUpdate()
    })
  }

  const photos = memory.memory_photos
  const date = new Date(memory.visited_at)
  const priceStr = venueDetails?.priceLevel ? '£'.repeat(venueDetails.priceLevel) : null

  if (editing) {
    return (
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-base" style={{ color: '#0D4F57' }}>Edit memory</h3>
          <button onClick={() => setEditing(false)} className="text-xs px-3 py-1 rounded-lg" style={{ color: '#7D878D', background: '#f5f2ed' }}>Cancel</button>
        </div>
        <div className="mb-3">
          <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>Dish name</label>
          <input type="text" value={editDish} onChange={e => setEditDish(e.target.value)} placeholder="What did you have?"
            className="w-full text-sm px-4 py-2.5 rounded-xl outline-none" style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
        </div>
        <div className="mb-4">
          <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>Notes</label>
          <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="What made it special?" rows={3}
            className="w-full text-sm px-4 py-2.5 rounded-xl outline-none resize-none" style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
        </div>
        <div className="mb-5 rounded-2xl p-4" style={{ background: '#f5f2ed' }}>
          <RatingSliders ratings={editRatings} onChange={setEditRatings} title="Update ratings" />
        </div>
        <button onClick={handleSaveEdit} className="press w-full py-3 rounded-2xl text-white font-semibold text-sm"
          style={{ background: '#0D4F57' }}>Save changes</button>
      </div>
    )
  }

  return (
    <>
      {/* Photos — square crop, natural and clean */}
      {photos.length > 0 && (
        <div className="relative overflow-hidden cursor-pointer" style={{ background: '#f5f2ed' }}
          onClick={() => setLightboxOpen(true)}>
          <PhotoCarousel photos={photos} current={currentPhoto} onChange={setCurrentPhoto} />
          {photos.length > 1 && (
            <div className="flex items-center justify-center gap-2 py-2" style={{ background: '#f5f2ed' }}>
              {currentPhoto > 0 && (
                <button onClick={() => setCurrentPhoto(p => p - 1)}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(13,79,87,0.1)', color: '#0D4F57', fontSize: 16 }}>‹</button>
              )}
              {photos.map((_, i) => (
                <button key={i} onClick={() => setCurrentPhoto(i)} className="rounded-full transition-all"
                  style={{ width: i === currentPhoto ? 18 : 6, height: 6, background: i === currentPhoto ? '#0D4F57' : '#b0babe' }} />
              ))}
              {currentPhoto < photos.length - 1 && (
                <button onClick={() => setCurrentPhoto(p => p + 1)}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(13,79,87,0.1)', color: '#0D4F57', fontSize: 16 }}>›</button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="px-5 pt-4 pb-5">
        {/* Title row */}
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-semibold leading-tight flex-1 mr-3" style={{ color: '#0D4F57' }}>{memory.venue?.name ?? 'Memory'}</h2>
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
            style={{ background: '#f5f2ed', color: '#7D878D' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
        </div>

        {/* Public / Private toggle */}
        <PublicToggle memoryId={memory.id} initialValue={memory.is_public} venue={memory.venue} onUpdate={onUpdate} />

        {/* Meta */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {memory.venue?.address && <p className="text-xs" style={{ color: '#7D878D' }}>{memory.venue.address}</p>}
          <span style={{ color: '#d4cdc3', fontSize: 10 }}>·</span>
          <p className="text-xs" style={{ color: '#7D878D' }}>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          {priceStr && <><span style={{ color: '#d4cdc3', fontSize: 10 }}>·</span><span className="text-xs" style={{ color: '#7D878D' }}>{priceStr}</span></>}
          {venueDetails?.openNow !== null && venueDetails?.openNow !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: venueDetails.openNow ? 'rgba(13,79,87,0.08)' : 'rgba(163,45,45,0.07)', color: venueDetails.openNow ? '#0D4F57' : '#a32d2d' }}>
              {venueDetails.openNow ? 'Open' : 'Closed'}
            </span>
          )}
        </div>

        {/* Rating — overall is out of 10; stars show it on a 5-star scale */}
        {shown.rating && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2.5 rounded-xl" style={{ background: '#f5f2ed' }}>
            <div className="flex items-center gap-1.5 flex-1">
              <StarRow value={shown.rating / 2} max={5} />
              <span className="text-sm font-semibold" style={{ color: '#C9A86A' }}>{shown.rating}/10</span>
            </div>
            {venueDetails?.rating && (
              <span className="text-xs" style={{ color: '#7D878D' }}>Google {venueDetails.rating}★</span>
            )}
          </div>
        )}

        {/* Breakdown bars — only categories the user actually rated */}
        {(shown.rating_food || shown.rating_service || shown.rating_ambiance) && (
          <div className="mb-3 px-3 py-2.5 rounded-xl" style={{ background: '#f5f2ed' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#0D4F57' }}>Breakdown</p>
            {([
              ['Food & drink', shown.rating_food],
              ['Service', shown.rating_service],
              ['Ambiance', shown.rating_ambiance],
            ] as const).filter(([, val]) => val).map(([label, val]) => (
              <div key={label} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs w-20 flex-shrink-0" style={{ color: '#7D878D' }}>{label}</span>
                <div className="flex gap-0.5 flex-1">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className="flex-1 rounded-sm" style={{ height: 5, background: i < val! ? '#C9A86A' : '#d4cdc3', opacity: i < val! ? 1 : 0.4 }} />
                  ))}
                </div>
                <span className="text-xs font-medium w-4 text-right" style={{ color: '#C9A86A' }}>{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Dish + notes inline */}
        {(shown.dish_name || shown.notes) && (
          <div className="mb-3 px-3 py-2.5 rounded-xl" style={{ background: '#f5f2ed' }}>
            {shown.dish_name && <p className="text-xs font-semibold mb-0.5" style={{ color: '#0D4F57' }}>{shown.dish_name}</p>}
            {shown.notes && <p className="text-xs leading-relaxed" style={{ color: '#7D878D' }}>{shown.notes}</p>}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2" style={{ alignItems: 'stretch' }}>
          {venueDetails?.website && (
            <a href={venueDetails.website} target="_blank" rel="noopener noreferrer"
              className="flex-1 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
              style={{ background: '#0D4F57', color: '#EAE5DD' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Website
            </a>
          )}
          {venueDetails?.phone && (
            <a href={`tel:${venueDetails.phone}`} className="flex-1 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5" style={{ background: '#f5f2ed', color: '#0D4F57' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.64 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.12 6.12l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Call
            </a>
          )}
          <a href={venueDetails?.website
              ?? `https://www.google.com/search?q=${encodeURIComponent(((memory.venue?.name ?? '') + ' ' + (memory.venue?.address ?? '')).trim())}`}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
            style={{ background: '#f5f2ed', color: '#0D4F57' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            {venueDetails?.website ? 'Website' : 'Search'}
          </a>
        </div>
      </div>

    {/* Fullscreen lightbox */}
    {lightboxOpen && (
      <Lightbox photos={photos} initialIndex={currentPhoto} onClose={() => setLightboxOpen(false)} />
    )}
  </>
  )
}

function PhotoCarousel({ photos, current, onChange }: { photos: MemoryWithDetails['memory_photos']; current: number; onChange: (i: number) => void }) {
  void onChange
  return (
    <div className="relative w-full">
      {photos.map((p, i) => (
        <div key={p.id} style={{ display: i === current ? 'block' : 'none' }}>
          <CarouselPhoto storagePath={p.storage_path} />
        </div>
      ))}
    </div>
  )
}

function CarouselPhoto({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const supabase = createClient()
  const isVideo = storagePath.match(/\.(mp4|mov|webm|m4v)$/i)

  useEffect(() => {
    getSignedPhotoUrl(supabase, storagePath).then(u => { if (u) setUrl(u) })
  }, [storagePath])

  if (!url) return <div className="animate-pulse" style={{ height: 200, background: '#EAE5DD' }} />

  if (isVideo) {
    return (
      <div className="relative" style={{ background: '#111' }}>
        <video src={url} controls playsInline style={{ width: '100%', maxHeight: '50vh', display: 'block' }} />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt=""
      style={{ width: '100%', height: 'auto', maxHeight: '45vh', objectFit: 'contain', background: '#f5f2ed', display: 'block' }}
    />
  )
}

// Public/private toggle for a memory
function PublicToggle({ memoryId, initialValue, venue, onUpdate }: { memoryId: string; initialValue: boolean; venue: { lat: number; lng: number } | null; onUpdate: () => void }) {
  const [isPublic, setIsPublic] = useState(initialValue)
  const supabase = createClient()

  async function toggle() {
    const newVal = !isPublic
    setIsPublic(newVal)
    // Going public: (re)store the ~1km fuzzed coords so friends never see the exact location
    const fuzzed = newVal && venue ? fuzzCoordinates(venue.lat, venue.lng) : null
    await supabase.from('memories').update({
      is_public: newVal,
      ...(fuzzed ? { public_lat: fuzzed.lat, public_lng: fuzzed.lng } : {}),
    }).eq('id', memoryId)
    onUpdate()
  }

  return (
    <div className="flex items-center gap-2 mb-3">
      <button onClick={toggle}
        style={{ width: 36, height: 20, borderRadius: 10, background: isPublic ? '#0D4F57' : '#d4cdc3', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', top: 2, left: isPublic ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
      <span className="text-xs" style={{ color: isPublic ? '#0D4F57' : '#7D878D' }}>
        {isPublic ? 'Shared — friends you’ve added can see this' : 'Private — only you can see this'}
      </span>
    </div>
  )
}
