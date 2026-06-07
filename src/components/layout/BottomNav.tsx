'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { readPhotoExif, getExifMessage } from '@/lib/exif'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import PlacesSearch from '@/components/memory/PlacesSearch'
import { createClient } from '@/lib/supabase/client'

interface PlaceSuggestion {
  placeId: string; name: string; address: string; lat: number; lng: number
}
interface PhotoEntry {
  file: File; preview: string; lat: number | null; lng: number | null; takenAt: Date | null; exifMessage: string | null
}
interface DetailRatings { food: number; service: number; ambiance: number }

function calcOverall(r: DetailRatings): number {
  const vals = [r.food, r.service, r.ambiance].filter(v => v > 0)
  if (!vals.length) return 0
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
}

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null) // fallback for web
  const [showForm, setShowForm] = useState(false)
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [locationQuery, setLocationQuery] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null)
  const [dishName, setDishName] = useState('')
  const [notes, setNotes] = useState('')
  const [ratings, setRatings] = useState<DetailRatings>({ food: 0, service: 0, ambiance: 0 })
  const [detectedDate, setDetectedDate] = useState<Date | null>(null)
  const [detectedLat, setDetectedLat] = useState<number | null>(null)
  const [detectedLng, setDetectedLng] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const isActive = (href: string) => href === '/places' ? pathname.startsWith('/places') : pathname === href

  async function handleCameraOpen() {
    try {
      // Try native Capacitor camera first (iOS app)
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: false,
      })
      if (image.dataUrl) {
        // Convert dataUrl to File
        const res = await fetch(image.dataUrl)
        const blob = await res.blob()
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
        const exif = await readPhotoExif(file)
        setPhotos([{ file, preview: image.dataUrl, lat: exif.lat, lng: exif.lng, takenAt: exif.takenAt, exifMessage: getExifMessage(exif) }])
        if (exif.lat) { setDetectedLat(exif.lat); setDetectedLng(exif.lng) }
        if (exif.takenAt) setDetectedDate(exif.takenAt)
        setShowForm(true)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // User cancelled or web fallback
      if (msg.includes('cancelled') || msg.includes('canceled') || msg.includes('User cancelled')) return
      // On web, fall back to file input
      fileInputRef.current?.click()
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const newPhotos: PhotoEntry[] = []
    for (const file of files) {
      const exif = await readPhotoExif(file)
      newPhotos.push({ file, preview: URL.createObjectURL(file), lat: exif.lat, lng: exif.lng, takenAt: exif.takenAt, exifMessage: getExifMessage(exif) })
      if (exif.lat && !detectedLat) { setDetectedLat(exif.lat); setDetectedLng(exif.lng) }
      if (exif.takenAt && !detectedDate) setDetectedDate(exif.takenAt)
    }
    setPhotos(newPhotos)
    setShowForm(true)
    e.target.value = ''
  }

  function closeForm() {
    setShowForm(false)
    setPhotos([]); setLocationQuery(''); setSelectedPlace(null)
    setDishName(''); setNotes(''); setSaveError(null)
    setRatings({ food: 0, service: 0, ambiance: 0 })
    setDetectedDate(null); setDetectedLat(null); setDetectedLng(null)
  }

  async function handleSave() {
    setSaveError(null)
    if (!locationQuery.trim()) { setSaveError('Please add a location.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaveError('Please sign in.'); setSaving(false); return }

      let venueId: string | null = null
      const vData = { name: selectedPlace?.name ?? locationQuery.trim(), lat: selectedPlace?.lat ?? detectedLat ?? 0, lng: selectedPlace?.lng ?? detectedLng ?? 0, google_place_id: selectedPlace?.placeId ?? null, address: selectedPlace?.address ?? null }
      if (selectedPlace?.placeId) {
        const { data: ev } = await supabase.from('venues').select('id').eq('google_place_id', selectedPlace.placeId).single()
        if (ev) { venueId = ev.id } else { const { data: nv } = await supabase.from('venues').insert(vData).select('id').single(); venueId = nv?.id }
      } else { const { data: nv } = await supabase.from('venues').insert(vData).select('id').single(); venueId = nv?.id }

      const overall = calcOverall(ratings)
      const { data: memory, error: me } = await supabase.from('memories').insert({
        user_id: user.id, venue_id: venueId, dish_name: dishName || null, notes: notes || null,
        rating: overall > 0 ? parseFloat(overall.toFixed(1)) : null, is_public: false,
        visited_at: detectedDate?.toISOString() ?? new Date().toISOString(),
      }).select().single()

      if (me) { setSaveError(me.message); setSaving(false); return }

      for (const photo of photos) {
        const ext = photo.file.name.split('.').pop()
        const path = `${user.id}/${memory.id}/${Date.now()}.${ext}`
        const { error: ue } = await supabase.storage.from('memory-photos').upload(path, photo.file, { upsert: true })
        if (!ue) await supabase.from('memory_photos').insert({ memory_id: memory.id, storage_path: path, lat: photo.lat, lng: photo.lng, taken_at: photo.takenAt?.toISOString() ?? null })
      }

      closeForm()
      router.refresh()
    } catch (err) { console.error(err); setSaveError('Something went wrong.') }
    finally { setSaving(false) }
  }

  const overall = calcOverall(ratings)
  const displayDate = detectedDate ?? new Date()

  return (
    <>


      {/* Full-screen save form — slides up over current page */}
      {showForm && (
        <div className="fixed inset-0 z-[60]" style={{ background: '#EAE5DD' }}>
          <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as never }}>
            {/* Header */}
            <div className="page-header px-5 pb-4">
              <div className="flex items-center gap-3">
                <button onClick={closeForm} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
                <h1 className="text-xl font-semibold text-white">Save memory</h1>
              </div>
            </div>

            <div className="px-4 pt-4 flex flex-col gap-4" style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>

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
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 rounded-2xl flex flex-col items-center justify-center gap-1"
                  style={{ width: 90, height: 90, background: '#fff', border: '2px dashed #C9A86A' }}>
                  <span style={{ fontSize: 22, color: '#C9A86A' }}>+</span>
                </button>
              </div>

              {/* EXIF messages */}
              {[...new Set(photos.map(p => p.exifMessage).filter(Boolean))].map((msg, i) => (
                <div key={i} className="rounded-xl px-3 py-2.5 text-xs" style={{ background: '#fff9e6', color: '#7a4b0a', borderLeft: '3px solid #C9A86A' }}>{msg}</div>
              ))}

              {/* Date */}
              <span className="text-xs px-3 py-1.5 rounded-full self-start" style={{ background: '#fff', color: '#0D4F57', border: '0.5px solid rgba(13,79,87,0.1)' }}>
                🕐 {displayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {detectedDate && <span className="ml-1 opacity-50">from photo</span>}
              </span>

              {/* Location */}
              <div className="rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
                <label className="text-xs font-semibold block mb-2" style={{ color: '#7D878D' }}>Restaurant</label>
                <PlacesSearch value={locationQuery}
                  onChange={v => { setLocationQuery(v); setSelectedPlace(null) }}
                  onSelect={p => { setSelectedPlace(p); setLocationQuery(p.name); setDetectedLat(p.lat); setDetectedLng(p.lng) }}
                  selectedPlace={selectedPlace} />
              </div>

              {/* Dish */}
              <div className="rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
                <label className="text-xs font-semibold block mb-2" style={{ color: '#7D878D' }}>Dish <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input type="text" value={dishName} onChange={e => setDishName(e.target.value)} placeholder="e.g. Truffle pasta"
                  className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
                  style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
              </div>

              {/* Ratings */}
              <div className="rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
                <p className="text-xs font-semibold mb-3" style={{ color: '#0D4F57' }}>Rate your experience</p>
                {([['food', 'Food'], ['service', 'Service'], ['ambiance', 'Ambiance']] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-3 mb-2.5">
                    <span className="text-xs w-16 flex-shrink-0" style={{ color: '#7D878D' }}>{label}</span>
                    <div className="flex gap-1 flex-1">
                      {Array.from({ length: 10 }, (_, i) => (
                        <button key={i} onClick={() => setRatings(prev => ({ ...prev, [key]: i + 1 === prev[key] ? 0 : i + 1 }))}
                          className="flex-1 rounded-sm" style={{ height: 18, background: i < ratings[key] ? '#C9A86A' : '#d4cdc3', opacity: i < ratings[key] ? 1 : 0.4 }} />
                      ))}
                    </div>
                    <span className="text-xs w-5 text-right font-medium" style={{ color: ratings[key] > 0 ? '#C9A86A' : '#b0babe' }}>{ratings[key] || '—'}</span>
                  </div>
                ))}
                {overall > 0 && (
                  <div className="flex items-center pt-2.5" style={{ borderTop: '0.5px solid rgba(13,79,87,0.1)' }}>
                    <span className="text-xs font-semibold" style={{ color: '#0D4F57' }}>Overall</span>
                    <span className="text-sm font-semibold ml-auto" style={{ color: '#C9A86A' }}>{overall}/10</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
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
        </div>
      )}

      {/* Nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ background: 'rgba(234,229,221,0.96)', backdropFilter: 'blur(12px)', borderTop: '0.5px solid rgba(13,79,87,0.12)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
        <div className="flex items-end justify-around px-2 pt-2 pb-3 relative">

          <NavItem href="/places" label="Places" active={isActive('/places')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/places') ? 2 : 1.5}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </NavItem>

          {/* Camera button — uses native Capacitor Camera */}
          <button onClick={handleCameraOpen} className="flex flex-col items-center gap-0.5" style={{ minWidth: 48, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <div style={{ color: '#7D878D' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
            <span style={{ fontSize: 10, color: '#7D878D', fontWeight: 400 }}>Capture</span>
          </button>
          {/* Web fallback input */}
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} />

          {/* Map — centre elevated */}
          <div className="flex flex-col items-center -mt-6">
            <Link href="/" style={{ textDecoration: 'none' }}>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-1"
                  style={{ background: isActive('/') ? '#C9A86A' : '#0D4F57', boxShadow: '0 4px 20px rgba(13,79,87,0.3)', border: '3px solid rgba(234,229,221,0.96)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
                </div>
                <span className="text-xs font-medium" style={{ color: isActive('/') ? '#C9A86A' : '#0D4F57', fontSize: 10 }}>Map</span>
              </div>
            </Link>
          </div>

          <NavItem href="/social" label="Social" active={isActive('/social')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/social') ? 2 : 1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </NavItem>

          <NavItem href="/profile" label="Profile" active={isActive('/profile')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive('/profile') ? 2 : 1.5}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </NavItem>

        </div>
      </nav>
    </>
  )
}

function NavItem({ href, label, active, children }: { href: string; label: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-0.5" style={{ textDecoration: 'none', minWidth: 48 }}>
      <div style={{ color: active ? '#0D4F57' : '#7D878D' }}>{children}</div>
      <span style={{ fontSize: 10, color: active ? '#0D4F57' : '#7D878D', fontWeight: active ? 600 : 400 }}>{label}</span>
      {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#C9A86A', marginTop: 1 }} />}
    </Link>
  )
}
