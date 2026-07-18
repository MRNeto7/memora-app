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
  const supabase = createClient()
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
    { value: 1, label: 'Low', color: 'var(--slate)' },
    { value: 2, label: 'Medium', color: 'var(--gold-500)' },
    { value: 3, label: 'Must visit', color: 'var(--teal-600)' },
  ]

  const canSave = !!(selectedPlace || locationQuery.trim())

  return (
    <>
      <div className="fixed z-20" style={{ top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(16,20,22,0.45)', backdropFilter: 'blur(2px)' }} onClick={onClose} />

      {/* Sheet — flex column with fixed footer */}
      <div className="fixed z-30 flex items-start justify-center pointer-events-none" style={{ top: 0, left: 0, right: 0, bottom: 0, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
      <div className="relative w-full bg-white rounded-3xl overflow-hidden flex flex-col pointer-events-auto"
        style={{ maxHeight: '100%', width: 'min(420px, 100%)' }}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0">
          <div />
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(16,20,22,0.08)', color: 'var(--slate)', fontSize: 14 }}>✕</button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '0.5px solid rgba(16,20,22,0.08)' }}>
          <h2 className="font-semibold text-base" style={{ color: 'var(--teal-600)' }}>Add to wishlist</h2>
          
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
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--slate)' }}>Priority</label>
            <div className="flex gap-2">
              {priorityOptions.map((opt) => (
                <button key={opt.value} onClick={() => setPriority(opt.value)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: priority === opt.value ? opt.color : 'var(--stone-200)',
                    color: priority === opt.value ? '#fff' : opt.color,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-2">
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--slate)' }}>
              Why do you want to go? <span style={{ fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Friend recommended it, seen it on Instagram…"
              className="w-full text-sm px-4 py-3 rounded-xl outline-none resize-none"
              style={{ border: '1.5px solid var(--stone-500)', background: 'var(--stone-100)' }}
            />
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 mt-2 text-sm"
              style={{ background: 'rgba(163,45,45,0.08)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}
        </div>

        {/* Fixed footer — always visible */}
        <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: '0.5px solid rgba(16,20,22,0.08)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--stone-200)', color: 'var(--teal-600)', opacity: saving || !canSave ? 0.5 : 1 }}
          >
            {saving ? 'Saving…' : '✓ Add to wishlist'}
          </button>
          {!canSave && <p className="text-center text-xs mt-2" style={{ color: 'var(--slate-light)' }}>Search for a restaurant first</p>}
        </div>
      </div>
    </div>
    </>
  )
}
