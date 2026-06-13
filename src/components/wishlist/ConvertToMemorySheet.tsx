'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readPhotoExif, getExifMessage, fuzzCoordinates } from '@/lib/exif'
import { filterMediaFiles } from '@/lib/uploads'
import { compressImage } from '@/lib/images'
import { calcOverall, DetailRatings } from '@/lib/ratings'
import { useIsPro, checkMemoryAllowance, FREE_PHOTOS_PER_MEMORY } from '@/lib/pro'
import Portal from '@/components/ui/Portal'
import RatingSliders from '@/components/ui/RatingSliders'
import Icon from '@/components/ui/Icon'
import PlacePhoto from '@/components/ui/PlacePhoto'

interface Venue {
  id: string; name: string; address: string | null; google_place_id: string | null; lat: number; lng: number
}

interface PhotoEntry {
  file: File; preview: string; lat: number | null; lng: number | null; takenAt: Date | null; exifMessage: string | null
}

interface ConvertToMemorySheetProps {
  venue: Venue
  wishlistId: string
  onClose: () => void
  onSaved: () => void
}

export default function ConvertToMemorySheet({ venue, wishlistId, onClose, onSaved }: ConvertToMemorySheetProps) {
  const supabase = createClient()
  const isPro = useIsPro()

  const [dishName, setDishName] = useState('')
  const [notes, setNotes] = useState('')
  const [ratings, setRatings] = useState<DetailRatings>({ food: 0, service: 0, ambiance: 0 })
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const overall = calcOverall(ratings)

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const { accepted: allAccepted, rejected } = await filterMediaFiles(files)
    let accepted = allAccepted
    if (isPro !== true && photos.length + accepted.length > FREE_PHOTOS_PER_MEMORY) {
      accepted = accepted.slice(0, Math.max(0, FREE_PHOTOS_PER_MEMORY - photos.length))
      rejected.push(`Free plan includes ${FREE_PHOTOS_PER_MEMORY} photos per memory — Mimora Pro (coming soon) unlocks unlimited photos.`)
    }
    if (rejected.length > 0) alert(rejected.join('\n'))
    const newPhotos: PhotoEntry[] = []
    for (const file of accepted) {
      const exif = await readPhotoExif(file)
      newPhotos.push({ file, preview: URL.createObjectURL(file), lat: exif.lat, lng: exif.lng, takenAt: exif.takenAt, exifMessage: getExifMessage(exif) })
      if (exif.takenAt) setVisitDate(exif.takenAt.toISOString().split('T')[0])
    }
    setPhotos(prev => [...prev, ...newPhotos])
    e.target.value = ''
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not signed in.'); return }

      const allowanceError = await checkMemoryAllowance(supabase, user.id, isPro)
      if (allowanceError) { setError(allowanceError); return }

      const fuzzed = venue.lat && venue.lng ? fuzzCoordinates(venue.lat, venue.lng) : null
      const { data: memory, error: me } = await supabase.from('memories').insert({
        user_id: user.id,
        venue_id: venue.id,
        dish_name: dishName || null,
        notes: notes || null,
        rating: overall > 0 ? overall : null,
        rating_food: ratings.food || null,
        rating_service: ratings.service || null,
        rating_ambiance: ratings.ambiance || null,
        is_public: false,
        public_lat: fuzzed?.lat ?? null, public_lng: fuzzed?.lng ?? null,
        visited_at: new Date(visitDate).toISOString(),
      }).select().single()

      if (me) { setError(me.message); return }

      for (const photo of photos) {
        const upload = await compressImage(photo.file)
        const ext = upload.name.split('.').pop()
        const path = `${user.id}/${memory.id}/${crypto.randomUUID()}.${ext}`
        const { error: ue } = await supabase.storage.from('memory-photos').upload(path, upload, { upsert: true, contentType: upload.type })
        if (!ue) await supabase.from('memory_photos').insert({ memory_id: memory.id, storage_path: path, lat: photo.lat, lng: photo.lng, taken_at: photo.takenAt?.toISOString() ?? null })
      }

      // Remove from wishlist
      await supabase.from('wishlists').delete().eq('id', wishlistId)

      onSaved()
    } catch (err) {
      console.error(err)
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Portal>
      <div className="backdrop-enter fixed z-[60]" style={{ top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(13,79,87,0.4)', backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)' }} onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none" style={{ padding: '12px 16px 88px' }}>
      <div className="sheet-enter relative w-full bg-white rounded-3xl overflow-hidden flex flex-col pointer-events-auto"
        style={{ maxHeight: '100%', width: 'min(420px, 100%)' }}>

        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: '#EAE5DD' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '0.5px solid rgba(13,79,87,0.08)' }}>
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#7D878D' }}>Saving memory at</p>
            <h2 className="font-semibold text-base" style={{ color: '#0D4F57' }}>{venue.name}</h2>
          </div>
          
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Venue mini card */}
          <div className="flex gap-3 items-center rounded-2xl overflow-hidden mb-4" style={{ background: '#f5f2ed' }}>
            <div style={{ width: 60, height: 60, flexShrink: 0, overflow: 'hidden' }}>
              <PlacePhoto placeId={venue.google_place_id} width={120} fallbackInitials={venue.name.slice(0,2).toUpperCase()}
                style={{ width: '100%', height: '100%' }} />
            </div>
            <div className="flex-1 pr-3">
              <p className="text-sm font-semibold" style={{ color: '#0D4F57' }}>{venue.name}</p>
              {venue.address && <p className="text-xs" style={{ color: '#7D878D' }}>{venue.address}</p>}
            </div>
          </div>

          {/* Photos */}
          <div className="mb-4">
            <label className="text-xs font-medium block mb-2" style={{ color: '#7D878D' }}>Photos <span style={{ fontWeight: 400 }}>(optional)</span></label>
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
                style={{ width: 80, height: 80, background: '#f5f2ed', border: '2px dashed #C9A86A' }}>
                <Icon name="camera" size={20} color="#C9A86A" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
              </label>
            </div>
          </div>

          {/* Date */}
          <div className="mb-4">
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>When did you visit?</label>
            <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)}
              className="w-full text-sm px-4 py-3 rounded-xl outline-none"
              style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9', color: '#0D4F57' }} />
          </div>

          {/* Dish */}
          <div className="mb-4">
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>What did you have? <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input type="text" value={dishName} onChange={e => setDishName(e.target.value)}
              placeholder="e.g. Half chicken, extra hot"
              className="w-full text-sm px-4 py-3 rounded-xl outline-none"
              style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
          </div>

          {/* Ratings */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: '#f5f2ed' }}>
            <RatingSliders ratings={ratings} onChange={setRatings} />
          </div>

          {/* Notes */}
          <div className="mb-2">
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="What made it special?"
              className="w-full text-sm px-4 py-3 rounded-xl outline-none resize-none"
              style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
          </div>

          {error && <div className="rounded-xl px-4 py-3 mt-2 text-sm" style={{ background: 'rgba(163,45,45,0.08)', color: '#a32d2d' }}>{error}</div>}
        </div>

        {/* Fixed footer */}
        <div className="flex-shrink-0 px-5 pt-3 pb-5" style={{ borderTop: '0.5px solid rgba(13,79,87,0.08)' }}>
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold"
            style={{ background: '#0D4F57', color: '#EAE5DD', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : '✓ Save memory'}
          </button>
          <p className="text-center text-xs mt-2" style={{ color: '#b0babe' }}>This will remove it from your wishlist</p>
        </div>
      </div>
    </div>
    </Portal>
  )
}
