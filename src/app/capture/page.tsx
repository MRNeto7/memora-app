'use client'

import { toast } from '@/lib/toast'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { readPhotoExif, getExifMessage, fuzzCoordinates } from '@/lib/exif'
import { filterMediaFiles, uploadPhotoWithThumb } from '@/lib/uploads'
import { calcOverall, DetailRatings } from '@/lib/ratings'
import { useIsPro, checkMemoryAllowance, FREE_PHOTOS_PER_MEMORY } from '@/lib/pro'
import RatingSliders from '@/components/ui/RatingSliders'
import CategoryPicker from '@/components/ui/CategoryPicker'
import { VenueType, MealType, venueTypeFromGoogle, mealTypeFromDate } from '@/lib/categories'
import Icon from '@/components/ui/Icon'
import CameraCapture from '@/components/capture/CameraCapture'
import PlacesSearch from '@/components/memory/PlacesSearch'
import { createClient } from '@/lib/supabase/client'

interface PlaceSuggestion {
  placeId: string; name: string; address: string; lat: number; lng: number
}

interface PhotoEntry {
  file: File
  preview: string
  lat: number | null
  lng: number | null
  takenAt: Date | null
  exifMessage: string | null
}

export default function CapturePage() {
  const router = useRouter()
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [stage, setStage] = useState<'prompt' | 'form'>('prompt')
  const [locationQuery, setLocationQuery] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null)
  const [dishName, setDishName] = useState('')
  const [notes, setNotes] = useState('')
  const [detailRatings, setDetailRatings] = useState<DetailRatings>({ food: 0, service: 0, ambiance: 0 })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [detectedDate, setDetectedDate] = useState<Date | null>(null)
  const [venueType, setVenueType] = useState<VenueType | null>(null)
  const [mealType, setMealType] = useState<MealType | null>(null)
  const [detectedLat, setDetectedLat] = useState<number | null>(null)
  const [detectedLng, setDetectedLng] = useState<number | null>(null)
  const supabase = createClient()
  const isPro = useIsPro()

  // Note: don't auto-trigger — programmatic file input clicks crash Capacitor WebViews

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    addPhotos(Array.from(files))
  }

  async function addPhotos(incoming: File[]) {
    if (incoming.length === 0) return
    const { accepted: allAccepted, rejected } = await filterMediaFiles(incoming, {
      allowVideo: isPro === true,
      videoRejectionMessage: 'Video memories are part of Mimora Pro — coming soon.',
    })
    let accepted = allAccepted
    if (isPro !== true && photos.length + accepted.length > FREE_PHOTOS_PER_MEMORY) {
      accepted = accepted.slice(0, Math.max(0, FREE_PHOTOS_PER_MEMORY - photos.length))
      rejected.push(`Free plan includes ${FREE_PHOTOS_PER_MEMORY} photos per memory — Mimora Pro (coming soon) unlocks unlimited photos.`)
    }
    if (rejected.length > 0) toast(rejected[0] + (rejected.length > 1 ? ` (+ more)` : ''), 'error')
    if (accepted.length === 0) return
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
      if (exif.lat && !detectedLat) { setDetectedLat(exif.lat); setDetectedLng(exif.lng) }
      if (exif.takenAt && !detectedDate) { setDetectedDate(exif.takenAt); setMealType(prev => prev ?? mealTypeFromDate(exif.takenAt)) }
    }
    setPhotos(prev => [...prev, ...newPhotos])
    setStage('form')
  }

  async function handleSave() {
    setSaveError(null)
    if (!locationQuery.trim()) { setSaveError('Please add a location.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaveError('Please sign in.'); setSaving(false); return }

      const allowanceError = await checkMemoryAllowance(supabase, user.id, isPro)
      if (allowanceError) { setSaveError(allowanceError); setSaving(false); return }

      let venueId: string | null = null
      const venueName = selectedPlace?.name ?? locationQuery.trim()
      const vData = {
        name: venueName,
        lat: selectedPlace?.lat ?? detectedLat ?? 0,
        lng: selectedPlace?.lng ?? detectedLng ?? 0,
        google_place_id: selectedPlace?.placeId ?? null,
        address: selectedPlace?.address ?? null,
      }
      if (selectedPlace?.placeId) {
        const { data: ev } = await supabase.from('venues').select('id').eq('google_place_id', selectedPlace.placeId).single()
        if (ev) { venueId = ev.id } else { const { data: nv } = await supabase.from('venues').insert(vData).select('id').single(); venueId = nv?.id ?? null }
      } else {
        const { data: nv } = await supabase.from('venues').insert(vData).select('id').single(); venueId = nv?.id ?? null
      }

      const overall = calcOverall(detailRatings)
      const fuzzed = vData.lat && vData.lng ? fuzzCoordinates(vData.lat, vData.lng) : null
      const { data: memory, error: me } = await supabase.from('memories').insert({
        user_id: user.id, venue_id: venueId,
        dish_name: dishName || null, notes: notes || null,
        rating: overall > 0 ? overall : null,
        rating_food: detailRatings.food || null,
        rating_service: detailRatings.service || null,
        rating_ambiance: detailRatings.ambiance || null,
        venue_type: venueType,
        meal_type: mealType,
        is_public: false,
        public_lat: fuzzed?.lat ?? null, public_lng: fuzzed?.lng ?? null,
        visited_at: detectedDate?.toISOString() ?? new Date().toISOString(),
      }).select().single()

      if (me) { setSaveError(me.message); setSaving(false); return }

      for (const photo of photos) {
        const path = await uploadPhotoWithThumb(supabase, user.id, memory.id, photo.file)
        if (path) await supabase.from('memory_photos').insert({ memory_id: memory.id, storage_path: path, lat: photo.lat, lng: photo.lng, taken_at: photo.takenAt?.toISOString() ?? null })
      }

      router.push('/places')
    } catch (err) {
      console.error(err)
      setSaveError('Something went wrong.')
    } finally { setSaving(false) }
  }

  const displayDate = detectedDate ?? new Date()

  if (stage === 'form') {
    return (
      <div className="page-enter min-h-screen flex flex-col" style={{ background: 'var(--stone-400)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="page-header px-5 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setStage('prompt')}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--stone-200)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16191B" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <h1 className="text-xl font-semibold">Save memory</h1>
          </div>
        </div>

        <div className="px-4 pt-4 flex flex-col gap-4">
          {/* Photos strip */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <div key={i} className="relative flex-shrink-0 rounded-2xl overflow-hidden" style={{ width: 90, height: 90 }}>
                <img src={p.preview} className="w-full h-full object-cover" />
                <button onClick={() => setPhotos(prev => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, j) => j !== i) })}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 10 }}>✕</button>
              </div>
            ))}
            <label className="flex-shrink-0 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer"
              style={{ width: 90, height: 90, background: '#fff', border: '2px dashed var(--gold-500)' }}>
              <span style={{ fontSize: 22 }}>+</span>
              <span className="text-xs" style={{ color: 'var(--gold-500)' }}>Add more</span>
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            </label>
          </div>

          {/* EXIF messages */}
          {[...new Set(photos.map(p => p.exifMessage).filter(Boolean))].map((msg, i) => (
            <div key={i} className="rounded-xl px-3 py-2.5 text-xs" style={{ background: '#fff9e6', color: '#7a4b0a', borderLeft: '3px solid var(--gold-500)' }}>{msg}</div>
          ))}

          {/* Date chip */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full" style={{ background: '#fff', color: 'var(--teal-600)', border: '0.5px solid rgba(16,20,22,0.1)' }}>
              <Icon name="clock" size={12} color="var(--teal-600)" />
              {displayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {detectedDate && <span className="ml-1 opacity-50 text-xs">from photo</span>}
            </span>
          </div>

          {/* Location */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(16,20,22,0.06)' }}>
            <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--slate)' }}>Restaurant</label>
            <PlacesSearch
              value={locationQuery}
              onChange={v => { setLocationQuery(v); setSelectedPlace(null) }}
              onSelect={p => { setSelectedPlace(p); setLocationQuery(p.name); setDetectedLat(p.lat); setDetectedLng(p.lng); setVenueType(prev => prev ?? venueTypeFromGoogle(p.googleTypes)) }}
              selectedPlace={selectedPlace}
            />
          </div>

          {/* Dish */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(16,20,22,0.06)' }}>
            <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--slate)' }}>Dish <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input type="text" value={dishName} onChange={e => setDishName(e.target.value)} placeholder="e.g. Truffle pasta"
              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
              style={{ border: '1.5px solid var(--stone-500)', background: 'var(--stone-100)' }} />
          </div>

          {/* Ratings */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(16,20,22,0.06)' }}>
            <div className="rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(16,20,22,0.08)' }}>
              <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--slate)' }}>Category</label>
              <CategoryPicker venueType={venueType} mealType={mealType} onVenueType={setVenueType} onMealType={setMealType} />
            </div>
            <RatingSliders ratings={detailRatings} onChange={setDetailRatings} />
          </div>

          {/* Notes */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(16,20,22,0.06)' }}>
            <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--slate)' }}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What made it special?" rows={2}
              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none resize-none"
              style={{ border: '1.5px solid var(--stone-500)', background: 'var(--stone-100)' }} />
          </div>

          {saveError && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(163,45,45,0.08)', color: 'var(--danger)' }}>{saveError}</div>}

          <button onClick={handleSave} disabled={saving || !locationQuery.trim()}
            className="w-full py-4 rounded-2xl font-semibold text-sm"
            style={{ background: 'var(--stone-200)', color: 'var(--teal-600)', opacity: saving || !locationQuery.trim() ? 0.5 : 1 }}>
            {saving ? 'Saving…' : '✓ Save memory'}
          </button>
        </div>
      </div>
    )
  }

  // Default: the camera-first capture screen
  return (
    <CameraCapture
      onFiles={handleFiles}
      onClose={() => router.push('/')}
    />
  )
}
