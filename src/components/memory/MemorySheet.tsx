'use client'

import { useState, useRef, useEffect } from 'react'
import { MemoryWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { readPhotoExif, getExifMessage } from '@/lib/exif'

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
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [detectedLat, setDetectedLat] = useState<number | null>(null)
  const [detectedLng, setDetectedLng] = useState<number | null>(null)
  const [detectedDate, setDetectedDate] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const overall = calcOverall(detailRatings)

  useEffect(() => {
    if (locationQuery.length < 2 || selectedPlace) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(locationQuery)}&lat=${detectedLat ?? ''}&lng=${detectedLng ?? ''}`)
        const data = await res.json()
        setSuggestions(data.places ?? [])
        setShowSuggestions(true)
      } catch { setSuggestions([]) }
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
            <h2 className="font-semibold text-base" style={{ color: '#0D4F57' }}>
              {isNew ? 'Save a memory' : (memory.venue?.name ?? 'Memory')}
            </h2>
            <button onClick={onClose} style={{ color: '#7D878D', fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>

          {/* ── VIEW MODE ── */}
          {!isNew && (
            <div>
              {memory.memory_photos.length > 0 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
                  {memory.memory_photos.map((p) => <SignedPhoto key={p.id} storagePath={p.storage_path} />)}
                </div>
              )}
              <div className="flex gap-2 mb-3 flex-wrap">
                {memory.venue && <Pill icon="📍">{memory.venue.name}</Pill>}
                {memory.venue?.address && <Pill icon="">{memory.venue.address}</Pill>}
                <Pill icon="🕐">{new Date(memory.visited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Pill>
              </div>
              {memory.rating && (
                <div className="flex items-center gap-2 mb-3">
                  <StarRow value={memory.rating} max={5} />
                  <span className="text-sm font-semibold" style={{ color: '#C9A86A' }}>{memory.rating}/5</span>
                </div>
              )}
              {memory.dish_name && <p className="font-medium text-sm mb-2" style={{ color: '#0D4F57' }}>{memory.dish_name}</p>}
              {memory.notes && (
                <p className="text-sm leading-relaxed pl-3" style={{ color: '#7D878D', borderLeft: '2px solid #C9A86A' }}>{memory.notes}</p>
              )}
            </div>
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

              {/* Location search */}
              <div className="mb-3 relative">
                <label className="text-xs mb-1 block font-medium" style={{ color: '#7D878D' }}>
                  Restaurant or bar
                  {selectedPlace && <span className="ml-2" style={{ color: '#0D4F57' }}>✓ linked to Google Maps</span>}
                </label>
                <input
                  type="text"
                  placeholder="Search restaurants, bars, cafes…"
                  value={locationQuery}
                  onChange={(e) => { setLocationQuery(e.target.value); setLocationName(e.target.value); setSelectedPlace(null) }}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  className="w-full text-sm px-4 py-3 rounded-xl outline-none"
                  style={{ border: `1.5px solid ${selectedPlace ? '#0D4F57' : '#EAE5DD'}`, background: '#fafaf9' }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 bg-white rounded-2xl z-50 overflow-hidden" style={{ top: '100%', marginTop: 4, border: '1px solid #EAE5DD', boxShadow: '0 8px 32px rgba(13,79,87,0.12)' }}>
                    {suggestions.map((s) => (
                      <button key={s.placeId} onClick={() => selectPlace(s)}
                        className="w-full text-left px-4 py-3 transition-colors hover:bg-gray-50"
                        style={{ borderBottom: '0.5px solid #f0ede8' }}>
                        <div className="text-sm font-medium" style={{ color: '#0D4F57' }}>📍 {s.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#7D878D' }}>{s.address}</div>
                        {s.rating && <div className="text-xs mt-0.5" style={{ color: '#C9A86A' }}>Google rating: {s.rating} ⭐</div>}
                      </button>
                    ))}
                    <button onClick={() => setShowSuggestions(false)} className="w-full text-center py-2 text-xs" style={{ color: '#b0babe' }}>Type manually instead</button>
                  </div>
                )}
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
