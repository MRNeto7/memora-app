'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PlacesSearch from '@/components/memory/PlacesSearch'

interface PlaceSuggestion {
  placeId: string; name: string; address: string; lat: number; lng: number
}

interface AddToWishlistButtonProps {
  onClose: () => void
  onSaved: () => void
}

export default function AddToWishlistButton({ onClose, onSaved }: AddToWishlistButtonProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null)
  const [locationQuery, setLocationQuery] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState(2)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!selectedPlace && !locationQuery.trim()) { setError('Search for a restaurant first.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not signed in.'); setSaving(false); return }

      let venueId: string | null = null
      if (selectedPlace) {
        const { data: ev } = await supabase.from('venues').select('id').eq('google_place_id', selectedPlace.placeId).single()
        if (ev) {
          venueId = ev.id
        } else {
          const { data: nv } = await supabase.from('venues').insert({
            name: selectedPlace.name, address: selectedPlace.address,
            lat: selectedPlace.lat, lng: selectedPlace.lng, google_place_id: selectedPlace.placeId,
          }).select('id').single()
          venueId = nv?.id ?? null
        }
      } else {
        const { data: nv } = await supabase.from('venues').insert({
          name: locationQuery.trim(), lat: 0, lng: 0
        }).select('id').single()
        venueId = nv?.id ?? null
      }

      if (!venueId) { setError('Could not save venue.'); setSaving(false); return }

      const { error: we } = await supabase.from('wishlists').insert({
        user_id: user.id, venue_id: venueId, notes: notes || null, priority
      })
      if (we) { setError(we.message); setSaving(false); return }
      onSaved()
    } catch (e) {
      console.error(e)
      setError('Something went wrong.')
      setSaving(false)
    }
  }

  const priorityOptions = [
    { value: 1, label: 'Low', color: '#7D878D' },
    { value: 2, label: 'Medium', color: '#C9A86A' },
    { value: 3, label: 'Must visit', color: '#0D4F57' },
  ]

  const canSave = !!(selectedPlace || locationQuery.trim())

  return (
    <>
      <div className="absolute inset-0 z-20" style={{ background: 'rgba(13,79,87,0.4)', bottom: 80 }} onClick={onClose} />

      {/* Sheet — flex column with fixed footer */}
      <div className="absolute left-0 right-0 z-30 bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: 'calc(88vh - 80px)', bottom: 80 }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: '#EAE5DD' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '0.5px solid rgba(13,79,87,0.08)' }}>
          <h2 className="font-semibold text-base" style={{ color: '#0D4F57' }}>Add to wishlist</h2>
          <button onClick={onClose} style={{ color: '#7D878D', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Search */}
          <div className="mb-4">
            <PlacesSearch
              value={locationQuery}
              onChange={(v) => { setLocationQuery(v); setSelectedPlace(null) }}
              onSelect={(p) => { setSelectedPlace(p); setLocationQuery(p.name) }}
              selectedPlace={selectedPlace}
            />
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="text-xs font-medium block mb-2" style={{ color: '#7D878D' }}>Priority</label>
            <div className="flex gap-2">
              {priorityOptions.map((opt) => (
                <button key={opt.value} onClick={() => setPriority(opt.value)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: priority === opt.value ? opt.color : '#f5f2ed',
                    color: priority === opt.value ? '#fff' : opt.color,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-2">
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>
              Why do you want to go? <span style={{ fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Friend recommended it, seen it on Instagram…"
              className="w-full text-sm px-4 py-3 rounded-xl outline-none resize-none"
              style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }}
            />
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 mt-2 text-sm"
              style={{ background: 'rgba(163,45,45,0.08)', color: '#a32d2d' }}>
              {error}
            </div>
          )}
        </div>

        {/* Fixed footer — always visible */}
        <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: '0.5px solid rgba(13,79,87,0.08)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold"
            style={{ background: '#0D4F57', color: '#EAE5DD', opacity: saving || !canSave ? 0.5 : 1 }}
          >
            {saving ? 'Saving…' : '✓ Add to wishlist'}
          </button>
          {!canSave && <p className="text-center text-xs mt-2" style={{ color: '#b0babe' }}>Search for a restaurant first</p>}
        </div>
      </div>
    </>
  )
}
