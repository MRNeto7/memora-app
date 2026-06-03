'use client'

import { useState, useRef, useEffect } from 'react'
import { MemoryWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { readPhotoExif, getExifMessage } from '@/lib/exif'

interface PlaceSuggestion {
  placeId: string
  name: string
  address: string
  lat?: number
  lng?: number
}

interface PhotoEntry {
  file: File
  preview: string
  lat: number | null
  lng: number | null
  takenAt: Date | null
  exifMessage: string | null
}

interface MemorySheetProps {
  memory: MemoryWithDetails | null
  onClose: () => void
  onUpdate: () => void
}

export default function MemorySheet({ memory, onClose, onUpdate }: MemorySheetProps) {
  const isNew = !memory
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dishName, setDishName] = useState(memory?.dish_name ?? '')
  const [notes, setNotes] = useState(memory?.notes ?? '')
  const [rating, setRating] = useState(memory?.rating ?? 0)
  const [locationName, setLocationName] = useState(memory?.venue?.name ?? '')
  const [locationQuery, setLocationQuery] = useState(memory?.venue?.name ?? '')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [detectedLat, setDetectedLat] = useState<number | null>(null)
  const [detectedLng, setDetectedLng] = useState<number | null>(null)
  const [detectedDate, setDetectedDate] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Autocomplete search
  useEffect(() => {
    if (locationQuery.length < 2 || selectedPlace) {
      setSuggestions([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(locationQuery)}&lat=${detectedLat ?? ''}&lng=${detectedLng ?? ''}`)
        const data = await res.json()
        setSuggestions(data.places ?? [])
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      }
    }, 350)
  }, [locationQuery, selectedPlace, detectedLat, detectedLng])

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const newPhotos: PhotoEntry[] = []
    for (const file of files) {
      const exif = await readPhotoExif(file)
      const preview = URL.createObjectURL(file)
      newPhotos.push({
        file,
        preview,
        lat: exif.lat,
        lng: exif.lng,
        takenAt: exif.takenAt,
        exifMessage: getExifMessage(exif),
      })

      // Use first photo's location if not already set
      if (exif.lat && exif.lng && !detectedLat) {
        setDetectedLat(exif.lat)
        setDetectedLng(exif.lng)
        // Bias autocomplete to this location
      }
      if (exif.takenAt && !detectedDate) {
        setDetectedDate(exif.takenAt)
      }
    }
    setPhotos(prev => [...prev, ...newPhotos])
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  function selectPlace(place: PlaceSuggestion) {
    setSelectedPlace(place)
    setLocationName(place.name)
    setLocationQuery(place.name)
    setSuggestions([])
    setShowSuggestions(false)
    if (place.lat) setDetectedLat(place.lat)
    if (place.lng) setDetectedLng(place.lng)
  }

  async function handleSave() {
    setSaveError(null)
    if (!locationName.trim()) {
      setSaveError('Please add a location before saving.')
      return
    }
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSaveError('You need to be signed in to save memories.')
        setSaving(false)
        return
      }

      // Upsert venue
      let venueId: string | null = null
      const venueData = {
        name: locationName.trim(),
        lat: selectedPlace?.lat ?? detectedLat ?? 0,
        lng: selectedPlace?.lng ?? detectedLng ?? 0,
        google_place_id: selectedPlace?.placeId ?? null,
        address: selectedPlace?.address ?? null,
      }

      const { data: existingVenue } = await supabase
        .from('venues')
        .select('id')
        .eq('google_place_id', venueData.google_place_id ?? '')
        .single()

      if (existingVenue) {
        venueId = existingVenue.id
      } else {
        const { data: newVenue } = await supabase
          .from('venues')
          .insert(venueData)
          .select('id')
          .single()
        venueId = newVenue?.id ?? null
      }

      // Insert memory
      const { data: newMemory, error: memoryError } = await supabase
        .from('memories')
        .insert({
          user_id: user.id,
          venue_id: venueId,
          dish_name: dishName || null,
          notes: notes || null,
          rating: rating || null,
          is_public: false,
          visited_at: detectedDate?.toISOString() ?? new Date().toISOString(),
        })
        .select()
        .single()

      if (memoryError) {
        setSaveError(`Error: ${memoryError.message}`)
        setSaving(false)
        return
      }

      // Upload all photos
      for (const photo of photos) {
        const ext = photo.file.name.split('.').pop()
        const path = `${user.id}/${newMemory.id}/${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('memory-photos')
          .upload(path, photo.file, { upsert: true })

        if (!uploadError) {
          await supabase.from('memory_photos').insert({
            memory_id: newMemory.id,
            storage_path: path,
            lat: photo.lat,
            lng: photo.lng,
            taken_at: photo.takenAt?.toISOString() ?? null,
          })
        }
      }

      onUpdate()
    } catch (err) {
      console.error('Save error:', err)
      setSaveError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const displayDate = detectedDate ?? (memory?.visited_at ? new Date(memory.visited_at) : new Date())
  const canSave = locationName.trim().length > 0
  const exifMessages = [...new Set(photos.map(p => p.exifMessage).filter(Boolean))]

  return (
    <>
      <div className="absolute inset-0 z-20" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={onClose} />

      <div
        className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl"
        style={{ maxHeight: '88vh', overflowY: 'auto', paddingBottom: 40 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base" style={{ color: '#1a2e23' }}>
              {isNew ? 'Save a memory' : memory.venue?.name ?? 'Memory'}
            </h2>
            <button onClick={onClose} style={{ color: '#9eb3a4', fontSize: 20 }}>✕</button>
          </div>

          {/* ── VIEWING MODE ── */}
          {!isNew && (
            <div>
              {/* Photos */}
              {memory.memory_photos.length > 0 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                  {memory.memory_photos.map((p) => (
                    <SignedPhoto key={p.id} storagePath={p.storage_path} />
                  ))}
                </div>
              )}

              <div className="flex gap-2 mb-3 flex-wrap">
                {memory.venue && (
                  <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#f0faf4', color: '#1e7a4c', border: '1px solid #bbe5cc' }}>
                    📍 {memory.venue.name}
                  </span>
                )}
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#f0faf4', color: '#1e7a4c', border: '1px solid #bbe5cc' }}>
                  🕐 {new Date(memory.visited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {memory.rating && (
                <div className="flex gap-1 mb-3">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ fontSize: 20, opacity: s <= memory.rating! ? 1 : 0.2 }}>⭐</span>
                  ))}
                </div>
              )}

              {memory.dish_name && (
                <p className="font-medium text-sm mb-2" style={{ color: '#1a2e23' }}>{memory.dish_name}</p>
              )}
              {memory.notes && (
                <p className="text-sm leading-relaxed" style={{ color: '#6b7c74', borderLeft: '2px solid #1e7a4c', paddingLeft: 10 }}>{memory.notes}</p>
              )}
            </div>
          )}

          {/* ── ADD MODE ── */}
          {isNew && (
            <>
              {/* Photo grid */}
              <div className="mb-4">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((p, i) => (
                    <div key={i} className="relative flex-shrink-0" style={{ width: 100, height: 100 }}>
                      <img src={p.preview} className="w-full h-full object-cover rounded-xl" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white"
                        style={{ background: 'rgba(0,0,0,0.5)', fontSize: 11 }}
                      >✕</button>
                    </div>
                  ))}

                  {/* Add photo button */}
                  <div
                    className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl cursor-pointer"
                    style={{ width: photos.length === 0 ? '100%' : 100, height: 100, background: '#f0faf4', border: '2px dashed #88d0aa' }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span style={{ fontSize: photos.length === 0 ? 28 : 20 }}>📷</span>
                    <span className="text-xs mt-1" style={{ color: '#1e7a4c' }}>
                      {photos.length === 0 ? 'Add photos' : '+'}
                    </span>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>

              {/* EXIF messages */}
              {exifMessages.map((msg, i) => (
                <div key={i} className="rounded-xl px-4 py-3 mb-3 text-xs leading-relaxed"
                  style={{ background: '#fff9e6', color: '#7a4b0a', borderLeft: '3px solid #f0a500' }}>
                  {msg}
                </div>
              ))}

              {/* Auto pills */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#f0faf4', color: '#1e7a4c', border: '1px solid #bbe5cc' }}>
                  🕐 {displayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {detectedDate && <span className="ml-1 opacity-60">auto</span>}
                </span>
              </div>

              {/* Location with Places autocomplete */}
              <div className="mb-3 relative">
                <label className="text-xs mb-1 block" style={{ color: '#6b7c74' }}>
                  Restaurant or bar
                  {selectedPlace && <span className="ml-2 text-green-600">✓ linked to Google Maps</span>}
                </label>
                <input
                  type="text"
                  placeholder="Search restaurants, bars, cafes..."
                  value={locationQuery}
                  onChange={(e) => {
                    setLocationQuery(e.target.value)
                    setLocationName(e.target.value)
                    setSelectedPlace(null)
                  }}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  className="w-full text-sm px-3 py-2 rounded-xl outline-none"
                  style={{ border: `1px solid ${selectedPlace ? '#1e7a4c' : '#e0e0e0'}`, background: '#fafafa' }}
                />

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    className="absolute left-0 right-0 bg-white rounded-2xl z-50 overflow-hidden"
                    style={{ top: '100%', marginTop: 4, border: '1px solid #e8f0eb', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
                  >
                    {suggestions.map((s) => (
                      <button
                        key={s.placeId}
                        onClick={() => selectPlace(s)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                        style={{ borderBottom: '0.5px solid #f0f0f0' }}
                      >
                        <div className="text-sm font-medium" style={{ color: '#1a2e23' }}>📍 {s.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#9eb3a4' }}>{s.address}</div>
                      </button>
                    ))}
                    <button
                      onClick={() => setShowSuggestions(false)}
                      className="w-full text-center py-2 text-xs"
                      style={{ color: '#9eb3a4' }}
                    >
                      Type manually instead
                    </button>
                  </div>
                )}
              </div>

              {/* Dish name */}
              <div className="mb-3">
                <label className="text-xs mb-1 block" style={{ color: '#6b7c74' }}>Dish name <span className="opacity-50">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Truffle pasta"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl outline-none"
                  style={{ border: '1px solid #e0e0e0', background: '#fafafa' }}
                />
              </div>

              {/* Rating */}
              <div className="mb-3">
                <label className="text-xs mb-2 block" style={{ color: '#6b7c74' }}>Rating <span className="opacity-50">(optional)</span></label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(star => (
                    <button key={star} onClick={() => setRating(star === rating ? 0 : star)}
                      style={{ fontSize: 24, opacity: star <= rating ? 1 : 0.25, transition: 'opacity 0.15s' }}>
                      ⭐
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="text-xs mb-1 block" style={{ color: '#6b7c74' }}>Thoughts <span className="opacity-50">(optional)</span></label>
                <textarea
                  placeholder="What made it special?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full text-sm px-3 py-2 rounded-xl outline-none resize-none"
                  style={{ border: '1px solid #e0e0e0', background: '#fafafa' }}
                />
              </div>

              {saveError && (
                <div className="rounded-xl px-4 py-3 mb-4 text-sm"
                  style={{ background: '#fff0f0', color: '#a32d2d', borderLeft: '3px solid #e24b4a' }}>
                  {saveError}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="w-full py-3 rounded-2xl text-white font-semibold text-sm"
                style={{ background: '#1e7a4c', opacity: saving || !canSave ? 0.5 : 1 }}
              >
                {saving ? 'Saving…' : '✓ Save memory'}
              </button>
              {!canSave && <p className="text-center text-xs text-gray-400 mt-2">Search for a restaurant to save</p>}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// Component to load and display a signed photo URL from Supabase Storage
function SignedPhoto({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  useEffect(() => {
    async function load() {
      const { data } = await supabase.storage
        .from('memory-photos')
        .createSignedUrl(storagePath, 3600)
      if (data?.signedUrl) setUrl(data.signedUrl)
    }
    load()
  }, [storagePath])

  if (!url) return (
    <div className="flex-shrink-0 rounded-xl bg-gray-100 animate-pulse" style={{ width: 120, height: 120 }} />
  )

  return (
    <img
      src={url}
      className="flex-shrink-0 rounded-xl object-cover"
      style={{ width: 120, height: 120 }}
    />
  )
}
