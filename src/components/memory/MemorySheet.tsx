'use client'

import { useState, useRef, useEffect } from 'react'
import { MemoryWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { readPhotoExif, getExifMessage } from '@/lib/exif'
import PlacesSearch from './PlacesSearch'
import Lightbox from '@/components/media/Lightbox'

interface PlaceSuggestion {
  placeId: string; name: string; address: string; lat: number; lng: number; rating?: number
}
interface PhotoEntry {
  file: File; preview: string; lat: number | null; lng: number | null; takenAt: Date | null; exifMessage: string | null
}
interface DetailRatings { food: number; service: number; ambiance: number }

interface MemorySheetProps {
  memory: MemoryWithDetails | null
  onClose: () => void
  onUpdate: () => void
}

function calcOverall(r: DetailRatings): number {
  const vals = [r.food, r.service, r.ambiance].filter(v => v > 0)
  if (!vals.length) return 0
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length / 10 * 5) * 10) / 10
}

export default function MemorySheet({ memory, onClose, onUpdate }: MemorySheetProps) {
  const isNew = !memory
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    const newPhotos: PhotoEntry[] = []

    for (const file of files) {
      // Enforce 15 second limit on videos
      if (file.type.startsWith('video/')) {
        const duration = await getVideoDuration(file)
        if (duration > 15) {
          alert(`"${file.name}" is ${Math.round(duration)}s — videos must be 15 seconds or under.`)
          continue
        }
      }

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

  function getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => { window.URL.revokeObjectURL(video.src); resolve(video.duration) }
      video.onerror = () => resolve(0)
      video.src = URL.createObjectURL(file)
    })
  }

  async function handleSave() {
    setSaveError(null)
    if (!locationName.trim()) { setSaveError('Please add a location.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaveError('You need to be signed in.'); setSaving(false); return }

      let venueId: string | null = null
      const venueData = { name: locationName.trim(), lat: selectedPlace?.lat ?? detectedLat ?? 0, lng: selectedPlace?.lng ?? detectedLng ?? 0, google_place_id: selectedPlace?.placeId ?? null, address: selectedPlace?.address ?? null }
      if (selectedPlace?.placeId) {
        const { data: ev } = await supabase.from('venues').select('id').eq('google_place_id', selectedPlace.placeId).single()
        if (ev) { venueId = ev.id } else { const { data: nv } = await supabase.from('venues').insert(venueData).select('id').single(); venueId = nv?.id ?? null }
      } else { const { data: nv } = await supabase.from('venues').insert(venueData).select('id').single(); venueId = nv?.id ?? null }

      const { data: newMemory, error: me } = await supabase.from('memories').insert({
        user_id: user.id, venue_id: venueId, dish_name: dishName || null, notes: notes || null,
        rating: overall > 0 ? Math.round(overall) : null, is_public: false,
        visited_at: detectedDate?.toISOString() ?? new Date().toISOString(),
      }).select().single()

      if (me) { setSaveError(`Error: ${me.message}`); setSaving(false); return }

      for (const photo of photos) {
        const ext = photo.file.name.split('.').pop()
        const path = `${user.id}/${newMemory.id}/${Date.now()}.${ext}`
        const { error: ue } = await supabase.storage.from('memory-photos').upload(path, photo.file, { upsert: true })
        if (!ue) await supabase.from('memory_photos').insert({ memory_id: newMemory.id, storage_path: path, lat: photo.lat, lng: photo.lng, taken_at: photo.takenAt?.toISOString() ?? null })
      }
      onUpdate()
    } catch (err) { console.error(err); setSaveError('Something went wrong.') }
    finally { setSaving(false) }
  }

  const displayDate = detectedDate ?? (memory?.visited_at ? new Date(memory.visited_at) : new Date())
  const exifMessages = [...new Set(photos.map(p => p.exifMessage).filter(Boolean))]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed z-20" style={{ top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(13,79,87,0.45)', backdropFilter: 'blur(2px)' }} onClick={onClose} />

      {/* Centred modal card */}
      <div className="fixed z-30 flex items-start justify-center pointer-events-none" style={{ top: 0, left: 0, right: 0, bottom: 0, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
      <div className="relative w-full bg-white rounded-3xl overflow-hidden flex flex-col pointer-events-auto"
        style={{ maxHeight: '100%', width: 'min(420px, 100%)' }}>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── VIEW MODE ── */}
          {!isNew && <MemoryDetailView memory={memory} onUpdate={onUpdate} />}

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
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-start justify-center pt-8 text-white"
                        style={{ background: 'rgba(0,0,0,0.5)', fontSize: 10 }}>✕</button>
                    </div>
                  ))}
                  <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl cursor-pointer"
                    style={{ width: photos.length === 0 ? '100%' : 80, height: 80, background: '#f5f2ed', border: '2px dashed #C9A86A' }}
                    onClick={() => fileInputRef.current?.click()}>
                    <span style={{ fontSize: photos.length === 0 ? 24 : 18 }}>📷</span>
                    <span className="text-xs mt-1 text-center px-1" style={{ color: '#C9A86A', lineHeight: 1.3 }}>{photos.length === 0 ? 'Photos & videos' : '+'}</span>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handlePhotoSelect} />
              </div>

              {exifMessages.map((msg, i) => (
                <div key={i} className="rounded-xl px-3 py-2.5 mb-3 text-xs leading-relaxed" style={{ background: '#fff9e6', color: '#7a4b0a', borderLeft: '3px solid #C9A86A' }}>{msg}</div>
              ))}

              <div className="flex gap-2 mb-4 flex-wrap">
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#f0ede8', color: '#0D4F57' }}>
                  🕐 {displayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                <p className="text-xs font-semibold mb-3" style={{ color: '#0D4F57' }}>Rate your experience</p>
                {([['food', 'Food'], ['service', 'Service'], ['ambiance', 'Ambiance']] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-3 mb-2.5">
                    <span className="text-xs w-16 flex-shrink-0" style={{ color: '#7D878D' }}>{label}</span>
                    <div className="flex gap-1 flex-1">
                      {Array.from({ length: 10 }, (_, i) => (
                        <button key={i} onClick={() => setDetailRatings(prev => ({ ...prev, [key]: i + 1 === prev[key] ? 0 : i + 1 }))}
                          className="flex-1 rounded-sm" style={{ height: 18, background: i < detailRatings[key] ? '#C9A86A' : '#d4cdc3', opacity: i < detailRatings[key] ? 1 : 0.45 }} />
                      ))}
                    </div>
                    <span className="text-xs w-5 text-right font-medium" style={{ color: detailRatings[key] > 0 ? '#C9A86A' : '#b0babe' }}>{detailRatings[key] || '—'}</span>
                  </div>
                ))}
                {overall > 0 && (
                  <div className="flex items-center pt-2.5" style={{ borderTop: '0.5px solid rgba(13,79,87,0.1)' }}>
                    <span className="text-xs font-semibold" style={{ color: '#0D4F57' }}>Overall</span>
                    <span className="text-sm font-semibold ml-auto" style={{ color: '#C9A86A' }}>{overall}/5</span>
                  </div>
                )}
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
              className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm"
              style={{ background: '#0D4F57', opacity: saving || !locationName.trim() ? 0.5 : 1 }}>
              {saving ? 'Saving…' : '✓ Save memory'}
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  )
}

// ── Detailed ratings slider ──
function SliderRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1 flex-1">
      {Array.from({ length: 10 }, (_, i) => (
        <button key={i} onClick={() => onChange(i + 1 === value ? 0 : i + 1)}
          className="flex-1 rounded-sm" style={{ height: 18, background: i < value ? '#C9A86A' : '#d4cdc3', opacity: i < value ? 1 : 0.45 }} />
      ))}
    </div>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const [editDish, setEditDish] = useState(memory.dish_name ?? '')
  const [editNotes, setEditNotes] = useState(memory.notes ?? '')
  const [editRatings, setEditRatings] = useState<DetailRatings>({ food: 0, service: 0, ambiance: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (memory.venue?.google_place_id) {
      fetch(`/api/venue-details?placeId=${memory.venue.google_place_id}`)
        .then(r => r.json()).then(setVenueDetails).catch(() => {})
    }
  }, [memory.venue?.google_place_id])

  async function handleSaveEdit() {
    setSaving(true)
    const overall = calcOverall(editRatings)
    await supabase.from('memories').update({ dish_name: editDish || null, notes: editNotes || null, rating: overall > 0 ? Math.round(overall) : memory.rating }).eq('id', memory.id)
    setSaving(false); setEditing(false); onUpdate()
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
          <p className="text-xs font-semibold mb-3" style={{ color: '#0D4F57' }}>Update ratings</p>
          {([['food', 'Food'], ['service', 'Service'], ['ambiance', 'Ambiance']] as const).map(([key, label]) => (
            <div key={key} className="flex items-center gap-3 mb-2.5">
              <span className="text-xs w-16 flex-shrink-0" style={{ color: '#7D878D' }}>{label}</span>
              <SliderRating value={editRatings[key]} onChange={v => setEditRatings(prev => ({ ...prev, [key]: v }))} />
              <span className="text-xs w-5 text-right" style={{ color: '#C9A86A' }}>{editRatings[key] || '—'}</span>
            </div>
          ))}
        </div>
        <button onClick={handleSaveEdit} disabled={saving} className="w-full py-3 rounded-2xl text-white font-semibold text-sm"
          style={{ background: '#0D4F57', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save changes'}</button>
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
            <div className="flex items-start justify-center pt-8 gap-2 py-2" style={{ background: '#f5f2ed' }}>
              {currentPhoto > 0 && (
                <button onClick={() => setCurrentPhoto(p => p - 1)}
                  className="w-7 h-7 rounded-full flex items-start justify-center pt-8"
                  style={{ background: 'rgba(13,79,87,0.1)', color: '#0D4F57', fontSize: 16 }}>‹</button>
              )}
              {photos.map((_, i) => (
                <button key={i} onClick={() => setCurrentPhoto(i)} className="rounded-full transition-all"
                  style={{ width: i === currentPhoto ? 18 : 6, height: 6, background: i === currentPhoto ? '#0D4F57' : '#b0babe' }} />
              ))}
              {currentPhoto < photos.length - 1 && (
                <button onClick={() => setCurrentPhoto(p => p + 1)}
                  className="w-7 h-7 rounded-full flex items-start justify-center pt-8"
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
        <PublicToggle memoryId={memory.id} initialValue={memory.is_public} onUpdate={onUpdate} />

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

        {/* Rating */}
        {memory.rating && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2.5 rounded-xl" style={{ background: '#f5f2ed' }}>
            <div className="flex items-center gap-1.5 flex-1">
              <StarRow value={memory.rating} max={5} />
              <span className="text-sm font-semibold" style={{ color: '#C9A86A' }}>{memory.rating}/5</span>
            </div>
            {venueDetails?.rating && (
              <span className="text-xs" style={{ color: '#7D878D' }}>Google {venueDetails.rating}★</span>
            )}
          </div>
        )}

        {/* Breakdown bars */}
        {memory.rating && (
          <div className="mb-3 px-3 py-2.5 rounded-xl" style={{ background: '#f5f2ed' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#0D4F57' }}>Breakdown</p>
            {(['Food & drink', 'Service', 'Ambiance'] as const).map((label, idx) => {
              const vals = [8, 7, 9]
              return (
                <div key={label} className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs w-20 flex-shrink-0" style={{ color: '#7D878D' }}>{label}</span>
                  <div className="flex gap-0.5 flex-1">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div key={i} className="flex-1 rounded-sm" style={{ height: 5, background: i < vals[idx] ? '#C9A86A' : '#d4cdc3', opacity: i < vals[idx] ? 1 : 0.4 }} />
                    ))}
                  </div>
                  <span className="text-xs font-medium w-4 text-right" style={{ color: '#C9A86A' }}>{vals[idx]}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Dish + notes inline */}
        {(memory.dish_name || memory.notes) && (
          <div className="mb-3 px-3 py-2.5 rounded-xl" style={{ background: '#f5f2ed' }}>
            {memory.dish_name && <p className="text-xs font-semibold mb-0.5" style={{ color: '#0D4F57' }}>{memory.dish_name}</p>}
            {memory.notes && <p className="text-xs leading-relaxed" style={{ color: '#7D878D' }}>{memory.notes}</p>}
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const isVideo = storagePath.match(/\.(mp4|mov|webm|m4v)$/i)

  useEffect(() => {
    supabase.storage.from('memory-photos').createSignedUrl(storagePath, 3600)
      .then(({ data }: { data: { signedUrl: string } | null }) => { if (data?.signedUrl) setUrl(data.signedUrl) })
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
function PublicToggle({ memoryId, initialValue, onUpdate }: { memoryId: string; initialValue: boolean; onUpdate: () => void }) {
  const [isPublic, setIsPublic] = useState(initialValue)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  async function toggle() {
    const newVal = !isPublic
    setIsPublic(newVal)
    await supabase.from('memories').update({ is_public: newVal }).eq('id', memoryId)
    onUpdate()
  }

  return (
    <div className="flex items-center gap-2 mb-3">
      <button onClick={toggle}
        style={{ width: 36, height: 20, borderRadius: 10, background: isPublic ? '#0D4F57' : '#d4cdc3', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', top: 2, left: isPublic ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
      <span className="text-xs" style={{ color: isPublic ? '#0D4F57' : '#7D878D' }}>
        {isPublic ? 'Public — visible to friends' : 'Private — only you can see this'}
      </span>
    </div>
  )
}
