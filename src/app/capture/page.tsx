'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readPhotoExif, getExifMessage, fuzzCoordinates } from '@/lib/exif'
import { filterMediaFiles } from '@/lib/uploads'
import { compressImage } from '@/lib/images'
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

interface DetailRatings { food: number; service: number; ambiance: number }

function calcOverall(r: DetailRatings): number {
  const vals = [r.food, r.service, r.ambiance].filter(v => v > 0)
  if (!vals.length) return 0
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length / 10 * 5) * 10) / 10
}

export default function CapturePage() {
  const router = useRouter()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
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
  const [detectedLat, setDetectedLat] = useState<number | null>(null)
  const [detectedLng, setDetectedLng] = useState<number | null>(null)
  const supabase = createClient()

  // Note: don't auto-trigger — programmatic file input clicks crash Capacitor WebViews

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const { accepted, rejected } = await filterMediaFiles(Array.from(files), { allowVideo: true })
    if (rejected.length > 0) alert(rejected.join('\n'))
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
      if (exif.takenAt && !detectedDate) setDetectedDate(exif.takenAt)
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
        rating: overall > 0 ? Math.round(overall) : null,
        is_public: false,
        public_lat: fuzzed?.lat ?? null, public_lng: fuzzed?.lng ?? null,
        visited_at: detectedDate?.toISOString() ?? new Date().toISOString(),
      }).select().single()

      if (me) { setSaveError(me.message); setSaving(false); return }

      for (const photo of photos) {
        const upload = await compressImage(photo.file)
        const ext = upload.name.split('.').pop()
        const path = `${user.id}/${memory.id}/${crypto.randomUUID()}.${ext}`
        const { error: ue } = await supabase.storage.from('memory-photos').upload(path, upload, { upsert: true, contentType: upload.type })
        if (!ue) await supabase.from('memory_photos').insert({ memory_id: memory.id, storage_path: path, lat: photo.lat, lng: photo.lng, taken_at: photo.takenAt?.toISOString() ?? null })
      }

      router.push('/places')
    } catch (err) {
      console.error(err)
      setSaveError('Something went wrong.')
    } finally { setSaving(false) }
  }

  const overall = calcOverall(detailRatings)
  const displayDate = detectedDate ?? new Date()

  if (stage === 'form') {
    return (
      <div className="page-enter min-h-screen flex flex-col" style={{ background: '#EAE5DD', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="page-header px-5 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setStage('prompt')}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <h1 className="text-xl font-semibold text-white">Save memory</h1>
          </div>
        </div>

        <div className="px-4 pt-4 flex flex-col gap-4">
          {/* Photos strip */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <div key={i} className="relative flex-shrink-0 rounded-2xl overflow-hidden" style={{ width: 90, height: 90 }}>
                <img src={p.preview} className="w-full h-full object-cover" />
                <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 10 }}>✕</button>
              </div>
            ))}
            <button onClick={() => galleryRef.current?.click()}
              className="flex-shrink-0 rounded-2xl flex flex-col items-center justify-center gap-1"
              style={{ width: 90, height: 90, background: '#fff', border: '2px dashed #C9A86A' }}>
              <span style={{ fontSize: 22 }}>+</span>
              <span className="text-xs" style={{ color: '#C9A86A' }}>Add more</span>
            </button>
            <input ref={galleryRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          </div>

          {/* EXIF messages */}
          {[...new Set(photos.map(p => p.exifMessage).filter(Boolean))].map((msg, i) => (
            <div key={i} className="rounded-xl px-3 py-2.5 text-xs" style={{ background: '#fff9e6', color: '#7a4b0a', borderLeft: '3px solid #C9A86A' }}>{msg}</div>
          ))}

          {/* Date chip */}
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#fff', color: '#0D4F57', border: '0.5px solid rgba(13,79,87,0.1)' }}>
              🕐 {displayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {detectedDate && <span className="ml-1 opacity-50 text-xs">from photo</span>}
            </span>
          </div>

          {/* Location */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(13,79,87,0.06)' }}>
            <label className="text-xs font-semibold block mb-2" style={{ color: '#7D878D' }}>Restaurant</label>
            <PlacesSearch
              value={locationQuery}
              onChange={v => { setLocationQuery(v); setSelectedPlace(null) }}
              onSelect={p => { setSelectedPlace(p); setLocationQuery(p.name); setDetectedLat(p.lat); setDetectedLng(p.lng) }}
              selectedPlace={selectedPlace}
            />
          </div>

          {/* Dish */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(13,79,87,0.06)' }}>
            <label className="text-xs font-semibold block mb-2" style={{ color: '#7D878D' }}>Dish <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input type="text" value={dishName} onChange={e => setDishName(e.target.value)} placeholder="e.g. Truffle pasta"
              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
              style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
          </div>

          {/* Ratings */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(13,79,87,0.06)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: '#0D4F57' }}>Rate your experience</p>
            {([['food', 'Food'], ['service', 'Service'], ['ambiance', 'Ambiance']] as const).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3 mb-2.5">
                <span className="text-xs w-16 flex-shrink-0" style={{ color: '#7D878D' }}>{label}</span>
                <div className="flex gap-1 flex-1">
                  {Array.from({ length: 10 }, (_, i) => (
                    <button key={i} onClick={() => setDetailRatings(prev => ({ ...prev, [key]: i + 1 === prev[key] ? 0 : i + 1 }))}
                      className="flex-1 rounded-sm" style={{ height: 18, background: i < detailRatings[key] ? '#C9A86A' : '#d4cdc3', opacity: i < detailRatings[key] ? 1 : 0.4 }} />
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

          {/* Notes */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(13,79,87,0.06)' }}>
            <label className="text-xs font-semibold block mb-2" style={{ color: '#7D878D' }}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What made it special?" rows={2}
              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none resize-none"
              style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
          </div>

          {saveError && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(163,45,45,0.08)', color: '#a32d2d' }}>{saveError}</div>}

          <button onClick={handleSave} disabled={saving || !locationQuery.trim()}
            className="w-full py-4 rounded-2xl text-white font-semibold text-sm"
            style={{ background: '#0D4F57', opacity: saving || !locationQuery.trim() ? 0.5 : 1 }}>
            {saving ? 'Saving…' : '✓ Save memory'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: '#EAE5DD', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>

      <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6" style={{ background: '#0D4F57' }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#C9A86A" strokeWidth="1.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </div>

      <h1 className="text-xl font-semibold mb-2" style={{ color: '#0D4F57' }}>Capture a memory</h1>
      <p className="text-sm mb-8 leading-relaxed" style={{ color: '#7D878D', maxWidth: 280 }}>
        Take a photo of your meal and we&apos;ll save it as a memory on your map.
      </p>

      {/* Camera button — opens native camera */}
      <button onClick={() => cameraRef.current?.click()}
        className="w-full max-w-xs py-4 rounded-2xl text-white font-semibold text-sm mb-3 flex items-center justify-center gap-2"
        style={{ background: '#0D4F57' }}>
        📷 Take a photo
      </button>

      {/* Gallery button */}
      <button onClick={() => galleryRef.current?.click()}
        className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-sm mb-4 flex items-center justify-center gap-2"
        style={{ background: '#fff', color: '#0D4F57', border: '1.5px solid rgba(13,79,87,0.15)' }}>
        🖼️ Choose from library
      </button>

      <p className="text-xs" style={{ color: '#b0babe' }}>Or tap the map tab and press &quot;Save memory&quot;</p>

      {/* Hidden inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden"
        onChange={e => handleFiles(e.target.files)} />
      <input ref={galleryRef} type="file" accept="image/*,video/*" multiple className="hidden"
        onChange={e => handleFiles(e.target.files)} />
    </div>
  )
}
