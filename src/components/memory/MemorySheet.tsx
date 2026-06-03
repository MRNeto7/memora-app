'use client'

import { useState, useRef } from 'react'
import { MemoryWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { readPhotoExif, getExifMessage } from '@/lib/exif'

interface MemorySheetProps {
  memory: MemoryWithDetails | null // null = new memory
  onClose: () => void
  onUpdate: () => void
}

export default function MemorySheet({ memory, onClose, onUpdate }: MemorySheetProps) {
  const isNew = !memory
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dishName, setDishName] = useState(memory?.dish_name ?? '')
  const [notes, setNotes] = useState(memory?.notes ?? '')
  const [rating, setRating] = useState(memory?.rating ?? 0)
  const [locationName, setLocationName] = useState(memory?.venue?.name ?? '')
  const [exifMessage, setExifMessage] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [detectedLat, setDetectedLat] = useState<number | null>(null)
  const [detectedLng, setDetectedLng] = useState<number | null>(null)
  const [detectedDate, setDetectedDate] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))

    // Read EXIF data
    const exif = await readPhotoExif(file)
    const msg = getExifMessage(exif)
    setExifMessage(msg)

    if (exif.lat && exif.lng) {
      setDetectedLat(exif.lat)
      setDetectedLng(exif.lng)
      // Reverse geocode to get venue name
      await reverseGeocode(exif.lat, exif.lng)
    }

    if (exif.takenAt) {
      setDetectedDate(exif.takenAt)
    }
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
      const data = await res.json()
      if (data.name) setLocationName(data.name)
    } catch {
      // Silent fail — user can type manually
    }
  }

  async function handleSave() {
    if (!locationName && !detectedLat) return
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Upsert venue
      let venueId: string | null = null
      if (locationName || (detectedLat && detectedLng)) {
        const { data: venue } = await supabase
          .from('venues')
          .upsert({
            name: locationName || 'Unknown location',
            lat: detectedLat ?? 0,
            lng: detectedLng ?? 0,
          }, { onConflict: 'google_place_id' })
          .select()
          .single()
        venueId = venue?.id ?? null
      }

      // Insert memory
      const { data: newMemory, error } = await supabase
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

      if (error || !newMemory) throw error

      // Upload photo if selected
      if (photoFile && newMemory) {
        const ext = photoFile.name.split('.').pop()
        const path = `${user.id}/${newMemory.id}.${ext}`

        await supabase.storage
          .from('memory-photos')
          .upload(path, photoFile, { upsert: true })

        await supabase
          .from('memory_photos')
          .insert({
            memory_id: newMemory.id,
            storage_path: path,
            lat: detectedLat,
            lng: detectedLng,
            taken_at: detectedDate?.toISOString() ?? null,
          })
      }

      onUpdate()
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const displayDate = detectedDate ?? (memory?.visited_at ? new Date(memory.visited_at) : new Date())

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-20"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl"
        style={{ maxHeight: '85vh', overflowY: 'auto', paddingBottom: 32 }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pt-2">
          <h2 className="font-semibold text-base mb-4" style={{ color: '#1a2e23' }}>
            {isNew ? 'Save a memory' : memory.venue?.name ?? 'Memory'}
          </h2>

          {/* Photo area */}
          <div
            className="w-full rounded-2xl mb-4 flex items-center justify-center cursor-pointer overflow-hidden"
            style={{
              height: 160,
              background: photoPreview ? 'transparent' : '#f0faf4',
              border: photoPreview ? 'none' : '2px dashed #88d0aa',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Memory" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <span style={{ fontSize: 28 }}>📷</span>
                <span className="text-sm" style={{ color: '#1e7a4c' }}>Tap to add photo</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />

          {/* EXIF message */}
          {exifMessage && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm leading-relaxed"
              style={{ background: '#fff9e6', color: '#7a4b0a', borderLeft: '3px solid #f0a500' }}
            >
              {exifMessage}
            </div>
          )}

          {/* Auto-filled meta */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {locationName && (
              <span
                className="text-xs px-3 py-1 rounded-full flex items-center gap-1"
                style={{ background: '#f0faf4', color: '#1e7a4c', border: '1px solid #bbe5cc' }}
              >
                📍 {locationName}
                <span className="ml-1 opacity-60 text-xs">auto</span>
              </span>
            )}
            <span
              className="text-xs px-3 py-1 rounded-full"
              style={{ background: '#f0faf4', color: '#1e7a4c', border: '1px solid #bbe5cc' }}
            >
              🕐 {displayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {detectedDate && <span className="ml-1 opacity-60 text-xs">auto</span>}
            </span>
          </div>

          {/* Location (if not auto-detected) */}
          {!detectedLat && (
            <div className="mb-3">
              <label className="text-xs text-gray-400 mb-1 block">Location</label>
              <input
                type="text"
                placeholder="e.g. Franco Manca, Brixton"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl outline-none"
                style={{ border: '1px solid #e0e0e0', background: '#fafafa' }}
              />
            </div>
          )}

          {/* Dish name */}
          <div className="mb-3">
            <label className="text-xs text-gray-400 mb-1 block">Dish name <span className="opacity-50">(optional)</span></label>
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
            <label className="text-xs text-gray-400 mb-2 block">Rating <span className="opacity-50">(optional)</span></label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star === rating ? 0 : star)}
                  style={{ fontSize: 24, opacity: star <= rating ? 1 : 0.25, transition: 'opacity 0.15s' }}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-5">
            <label className="text-xs text-gray-400 mb-1 block">Thoughts <span className="opacity-50">(optional)</span></label>
            <textarea
              placeholder="What made it special?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full text-sm px-3 py-2 rounded-xl outline-none resize-none"
              style={{ border: '1px solid #e0e0e0', background: '#fafafa' }}
            />
          </div>

          {/* Save button */}
          {isNew && (
            <button
              onClick={handleSave}
              disabled={saving || (!locationName && !detectedLat)}
              className="w-full py-3 rounded-2xl text-white font-semibold text-sm transition-opacity"
              style={{
                background: '#1e7a4c',
                opacity: saving || (!locationName && !detectedLat) ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving…' : '✓ Save memory'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
