'use client'

import { useState, useRef, useEffect } from 'react'
import { MemoryWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { readPhotoExif, getExifMessage } from '@/lib/exif'
import PlacesSearch from './PlacesSearch'

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
  if (vals.length === 0) return 0
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  return Math.round((avg / 10) * 5 * 10) / 10
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
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  // suppress unused warning — kept for save logic compatibility
  void suggestions; void showSuggestions
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [detectedLat, setDetectedLat] = useState<number | null>(null)
  const [detectedLng, setDetectedLng] = useState<number | null>(null)
  const [detectedDate, setDetectedDate] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const overall = calcOverall(detailRatings)

  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (selectedPlace) { setSuggestions([]); return }
    if (locationQuery.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(locationQuery)}&lat=${detectedLat ?? ''}&lng=${detectedLng ?? ''}`)
        const data = await res.json()
        console.log('Places response:', data)
        setSuggestions(data.places ?? [])
        setShowSuggestions((data.places ?? []).length > 0)
      } catch (err) {
        console.error('Places fetch error:', err)
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }, [locationQuery, selectedPlace, detectedLat, detectedLng])

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const newPhotos: PhotoEntry[] = []
    for (const file of files) {
      const exif = await readPhotoExif(file)
      newPhotos.push({ file, preview: URL.createObjectURL(file), lat: exif.lat, lng: exif.lng, takenAt: exif.takenAt, exifMessage: getExifMessage(exif) })
      if (exif.lat && exif.lng && !detectedLat) { setDetectedLat(exif.lat); setDetectedLng(exif.lng) }
      if (exif.takenAt && !detectedDate) setDetectedDate(exif.takenAt)
    }
    setPhotos(prev => [...prev, ...newPhotos])
    e.target.value = ''
  }

  function selectPlace(place: PlaceSuggestion) {
    setSelectedPlace(place); setLocationName(place.name); setLocationQuery(place.name)
    setSuggestions([]); setShowSuggestions(false)
    if (place.lat) setDetectedLat(place.lat)
    if (place.lng) setDetectedLng(place.lng)
  }

  async function handleSave() {
    setSaveError(null)
    if (!locationName.trim()) { setSaveError('Please add a location.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaveError('You need to be signed in.'); setSaving(false); return }

      // Venue
      let venueId: string | null = null
      const venueData = {
        name: locationName.trim(),
        lat: selectedPlace?.lat ?? detectedLat ?? 0,
        lng: selectedPlace?.lng ?? detectedLng ?? 0,
        google_place_id: selectedPlace?.placeId ?? null,
        address: selectedPlace?.address ?? null,
      }
      if (selectedPlace?.placeId) {
        const { data: ev } = await supabase.from('venues').select('id').eq('google_place_id', selectedPlace.placeId).single()
        if (ev) { venueId = ev.id }
        else { const { data: nv } = await supabase.from('venues').insert(venueData).select('id').single(); venueId = nv?.id ?? null }
      } else {
        const { data: nv } = await supabase.from('venues').insert(venueData).select('id').single(); venueId = nv?.id ?? null
      }

      const finalRating = overall > 0 ? Math.round(overall) : null

      const { data: newMemory, error: me } = await supabase.from('memories').insert({
        user_id: user.id, venue_id: venueId, dish_name: dishName || null, notes: notes || null,
        rating: finalRating, is_public: false,
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
    } catch (err) {
      console.error(err); setSaveError('Something went wrong.')
    } finally { setSaving(false) }
  }

  const displayDate = detectedDate ?? (memory?.visited_at ? new Date(memory.visited_at) : new Date())
  const exifMessages = [...new Set(photos.map(p => p.exifMessage).filter(Boolean))]

  return (
    <>
      <div className="absolute inset-0 z-20" style={{ background: 'rgba(13,79,87,0.4)' }} onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl" style={{ maxHeight: '90vh', overflowY: 'auto', paddingBottom: 40 }}>
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: '#EAE5DD' }} />
        </div>

        <div className="px-5">
          <div className="flex items-center justify-between mb-4">
            {isNew && <h2 className="font-semibold text-base" style={{ color: '#0D4F57' }}>Save a memory</h2>}
            {!isNew && <div />}
            <button onClick={onClose} style={{ color: '#7D878D', fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>

          {/* ── VIEW MODE ── */}
          {!isNew && (
            <MemoryDetailView memory={memory} />
          )}

          {/* ── ADD MODE ── */}
          {isNew && (
            <>
              {/* Photos */}
              <div className="mb-4">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((p, i) => (
                    <div key={i} className="relative flex-shrink-0" style={{ width: 100, height: 100 }}>
                      <img src={p.preview} className="w-full h-full object-cover rounded-xl" />
                      <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white"
                        style={{ background: 'rgba(0,0,0,0.5)', fontSize: 11 }}>✕</button>
                    </div>
                  ))}
                  <div
                    className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl cursor-pointer"
                    style={{ width: photos.length === 0 ? '100%' : 100, height: 100, background: '#f5f2ed', border: '2px dashed #C9A86A' }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span style={{ fontSize: photos.length === 0 ? 28 : 20 }}>📷</span>
                    <span className="text-xs mt-1" style={{ color: '#C9A86A' }}>{photos.length === 0 ? 'Add photos' : '+'}</span>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handlePhotoSelect} />
              </div>

              {exifMessages.map((msg, i) => (
                <div key={i} className="rounded-xl px-4 py-3 mb-3 text-xs leading-relaxed" style={{ background: '#fff9e6', color: '#7a4b0a', borderLeft: '3px solid #C9A86A' }}>{msg}</div>
              ))}

              {/* Date pill */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <Pill icon="🕐">
                  {displayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {detectedDate && <span className="ml-1 opacity-60 text-xs">auto</span>}
                </Pill>
              </div>

              {/* Location search — Google Places Autocomplete (browser-side) */}
              <div className="mb-3">
                <PlacesSearch
                  value={locationQuery}
                  onChange={(v) => { setLocationQuery(v); setLocationName(v); setSelectedPlace(null) }}
                  onSelect={(place) => {
                    setSelectedPlace(place)
                    setLocationName(place.name)
                    setLocationQuery(place.name)
                    setDetectedLat(place.lat)
                    setDetectedLng(place.lng)
                  }}
                  selectedPlace={selectedPlace}
                />
              </div>

              {/* Dish name */}
              <div className="mb-4">
                <label className="text-xs mb-1 block font-medium" style={{ color: '#7D878D' }}>Dish <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input type="text" placeholder="e.g. Truffle pasta" value={dishName} onChange={(e) => setDishName(e.target.value)}
                  className="w-full text-sm px-4 py-3 rounded-xl outline-none" style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
              </div>

              {/* Detailed ratings */}
              <div className="mb-4 rounded-2xl p-4" style={{ background: '#f5f2ed', border: '0.5px solid rgba(13,79,87,0.08)' }}>
                <p className="text-xs font-semibold mb-3" style={{ color: '#0D4F57' }}>Rate your experience</p>
                {([['food', 'Food & drink'], ['service', 'Service'], ['ambiance', 'Ambiance']] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-3 mb-3">
                    <span className="text-xs w-20 flex-shrink-0" style={{ color: '#7D878D' }}>{label}</span>
                    <SliderRating value={detailRatings[key]} onChange={(v) => setDetailRatings(prev => ({ ...prev, [key]: v }))} />
                    <span className="text-xs w-8 text-right font-medium" style={{ color: detailRatings[key] > 0 ? '#C9A86A' : '#b0babe' }}>
                      {detailRatings[key] > 0 ? detailRatings[key] : '—'}
                    </span>
                  </div>
                ))}
                {overall > 0 && (
                  <div className="flex items-center gap-2 pt-3" style={{ borderTop: '0.5px solid rgba(13,79,87,0.1)' }}>
                    <span className="text-xs font-semibold" style={{ color: '#0D4F57' }}>Overall</span>
                    <StarRow value={overall} max={5} />
                    <span className="text-sm font-semibold ml-auto" style={{ color: '#C9A86A' }}>{overall}/5</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="text-xs mb-1 block font-medium" style={{ color: '#7D878D' }}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <textarea placeholder="What made it special?" value={notes} onChange={(e) => setNotes(e.target.value)}
                  rows={3} className="w-full text-sm px-4 py-3 rounded-xl outline-none resize-none"
                  style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
              </div>

              {saveError && (
                <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(163,45,45,0.08)', color: '#a32d2d', borderLeft: '3px solid #a32d2d' }}>{saveError}</div>
              )}

              <button onClick={handleSave} disabled={saving || !locationName.trim()}
                className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm"
                style={{ background: '#0D4F57', opacity: saving || !locationName.trim() ? 0.5 : 1 }}>
                {saving ? 'Saving…' : '✓ Save memory'}
              </button>
              {!locationName.trim() && <p className="text-center text-xs mt-2" style={{ color: '#b0babe' }}>Search for a restaurant to save</p>}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// Slider rating 1–10
function SliderRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5 flex-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button key={n} onClick={() => onChange(n === value ? 0 : n)}
          className="flex-1 rounded-sm transition-all"
          style={{ height: 20, background: n <= value ? '#C9A86A' : '#d4cdc3', opacity: n <= value ? 1 : 0.5 }} />
      ))}
    </div>
  )
}

// Star display (read-only)
function StarRow({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} style={{ position: 'relative', width: 16, height: 16 }}>
          <span style={{ fontSize: 14, opacity: 0.2 }}>★</span>
          <span style={{ fontSize: 14, position: 'absolute', left: 0, top: 0, overflow: 'hidden', width: `${Math.min(Math.max((value - i) * 100, 0), 100)}%`, color: '#C9A86A' }}>★</span>
        </div>
      ))}
    </div>
  )
}

// Pill badge
function Pill({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="text-xs px-3 py-1 rounded-full flex items-center gap-1 flex-shrink-0"
      style={{ background: '#f0ede8', color: '#0D4F57', border: '0.5px solid rgba(13,79,87,0.12)' }}>
      {icon && <span>{icon}</span>}{children}
    </span>
  )
}

// Load signed photo from Supabase Storage
function SignedPhoto({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  useEffect(() => {
    supabase.storage.from('memory-photos').createSignedUrl(storagePath, 3600).then(({ data }: { data: { signedUrl: string } | null }) => {
      if (data?.signedUrl) setUrl(data.signedUrl)
    })
  }, [storagePath])
  if (!url) return <div className="flex-shrink-0 rounded-2xl bg-gray-100 animate-pulse" style={{ width: 140, height: 140 }} />
  return <img src={url} className="flex-shrink-0 rounded-2xl object-cover" style={{ width: 140, height: 140 }} />
}


// ── Rich memory detail view ──
interface VenueDetails {
  website: string | null
  phone: string | null
  openNow: boolean | null
  rating: number | null
  totalRatings: number | null
  priceLevel: number | null
}

function MemoryDetailView({ memory }: { memory: MemoryWithDetails }) {
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [venueDetails, setVenueDetails] = useState<VenueDetails | null>(null)

  useEffect(() => {
    if (memory.venue?.google_place_id) {
      fetch(`/api/venue-details?placeId=${memory.venue.google_place_id}`)
        .then(r => r.json())
        .then(setVenueDetails)
        .catch(() => {})
    }
  }, [memory.venue?.google_place_id])

  const photos = memory.memory_photos
  const date = new Date(memory.visited_at)
  const priceStr = venueDetails?.priceLevel ? '£'.repeat(venueDetails.priceLevel) : null

  return (
    <div>
      {/* Photo carousel */}
      {photos.length > 0 && (
        <div className="relative mb-5 -mx-5 rounded-none overflow-hidden" style={{ height: 200 }}>
          <PhotoCarousel photos={photos} current={currentPhoto} onChange={setCurrentPhoto} />
          {photos.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {photos.map((_, i) => (
                <button key={i} onClick={() => setCurrentPhoto(i)}
                  className="rounded-full transition-all"
                  style={{ width: i === currentPhoto ? 20 : 6, height: 6, background: i === currentPhoto ? '#fff' : 'rgba(255,255,255,0.5)' }} />
              ))}
            </div>
          )}
          {photos.length > 1 && (
            <>
              {currentPhoto > 0 && (
                <button onClick={() => setCurrentPhoto(p => p - 1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 16 }}>‹</button>
              )}
              {currentPhoto < photos.length - 1 && (
                <button onClick={() => setCurrentPhoto(p => p + 1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 16 }}>›</button>
              )}
            </>
          )}
        </div>
      )}

      {/* Venue name as title */}
      <h2 className="text-xl font-semibold mb-1 leading-tight" style={{ color: '#0D4F57' }}>
        {memory.venue?.name ?? 'Memory'}
      </h2>

      {/* Address + date row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          {memory.venue?.address && (
            <p className="text-xs mb-1" style={{ color: '#7D878D' }}>{memory.venue.address}</p>
          )}
          <p className="text-xs" style={{ color: '#7D878D' }}>
            {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {venueDetails?.openNow !== null && venueDetails?.openNow !== undefined && (
          <span className="text-xs px-2 py-1 rounded-full flex-shrink-0 ml-3"
            style={{ background: venueDetails.openNow ? 'rgba(30,122,76,0.1)' : 'rgba(163,45,45,0.08)', color: venueDetails.openNow ? '#1e7a4c' : '#a32d2d' }}>
            {venueDetails.openNow ? 'Open now' : 'Closed'}
          </span>
        )}
      </div>

      {/* Rating + price */}
      <div className="flex items-center gap-3 mb-4">
        {memory.rating && (
          <div className="flex items-center gap-1.5">
            <StarRow value={memory.rating} max={5} />
            <span className="text-sm font-semibold" style={{ color: '#C9A86A' }}>{memory.rating}/5</span>
          </div>
        )}
        {priceStr && (
          <span className="text-sm font-medium" style={{ color: '#7D878D' }}>{priceStr}</span>
        )}
        {venueDetails?.rating && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f5f2ed', color: '#7D878D' }}>
            Google {venueDetails.rating}★ ({venueDetails.totalRatings?.toLocaleString()})
          </span>
        )}
      </div>

      {/* Dish + notes */}
      {memory.dish_name && (
        <div className="mb-3 px-4 py-3 rounded-xl" style={{ background: '#f5f2ed' }}>
          <p className="text-xs mb-0.5" style={{ color: '#7D878D' }}>What I had</p>
          <p className="text-sm font-medium" style={{ color: '#0D4F57' }}>{memory.dish_name}</p>
        </div>
      )}

      {memory.notes && (
        <div className="mb-4 px-4 py-3 rounded-xl" style={{ background: '#f5f2ed', borderLeft: '3px solid #C9A86A' }}>
          <p className="text-xs mb-1" style={{ color: '#7D878D' }}>Notes</p>
          <p className="text-sm leading-relaxed" style={{ color: '#0D4F57' }}>{memory.notes}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-2">
        {venueDetails?.website && (
          <a href={venueDetails.website} target="_blank" rel="noopener noreferrer"
            className="flex-1 py-2.5 rounded-xl text-xs font-medium text-center flex items-center justify-center gap-1.5"
            style={{ background: '#0D4F57', color: '#fff' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Website
          </a>
        )}
        {venueDetails?.phone && (
          <a href={`tel:${venueDetails.phone}`}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium text-center flex items-center justify-center gap-1.5"
            style={{ background: '#f5f2ed', color: '#0D4F57' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.64 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.12 6.12l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Call
          </a>
        )}
        <a
          href={`https://www.google.com/maps/place/?q=place_id:${memory.venue?.google_place_id ?? ''}`}
          target="_blank" rel="noopener noreferrer"
          className="flex-1 py-2.5 rounded-xl text-xs font-medium text-center flex items-center justify-center gap-1.5"
          style={{ background: '#f5f2ed', color: '#0D4F57' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
          Details
        </a>
      </div>
    </div>
  )
}

// Photo carousel — shows one photo at a time, full width
function PhotoCarousel({ photos, current, onChange }: {
  photos: MemoryWithDetails['memory_photos']
  current: number
  onChange: (i: number) => void
}) {
  void onChange
  return (
    <div className="relative w-full h-full">
      {photos.map((p, i) => (
        <div key={p.id} className="absolute inset-0 transition-opacity duration-300"
          style={{ opacity: i === current ? 1 : 0, pointerEvents: i === current ? 'auto' : 'none' }}>
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
  useEffect(() => {
    supabase.storage.from('memory-photos').createSignedUrl(storagePath, 3600)
      .then(({ data }: { data: { signedUrl: string } | null }) => { if (data?.signedUrl) setUrl(data.signedUrl) })
  }, [storagePath])
  if (!url) return <div className="w-full h-full animate-pulse" style={{ background: '#EAE5DD' }} />
  return <img src={url} className="w-full h-full" style={{ objectFit: "contain", background: "#1a1a1a" }} />
}
