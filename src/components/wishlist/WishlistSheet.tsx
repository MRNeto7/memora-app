'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import PlacePhoto from '@/components/ui/PlacePhoto'
import Portal from '@/components/ui/Portal'
import ConvertToMemorySheet from './ConvertToMemorySheet'

interface WishlistItem {
  id: string
  notes: string | null
  priority: number
  added_at: string
  venue: { id: string; name: string; address: string | null; google_place_id: string | null; lat: number; lng: number }
}

interface WishlistSheetProps {
  item: WishlistItem
  onClose: () => void
  onUpdate: () => void
}

export default function WishlistSheet({ item, onClose, onUpdate }: WishlistSheetProps) {
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [converting, setConverting] = useState(false)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [priority, setPriority] = useState(item.priority)

  // Hex, not var() — these get an alpha suffix appended (`${c}15`)
  const priorityColors = ['', '#7D878D', '#C9A86A', '#0D4F57']
  const priorityLabels = ['', 'Low', 'Medium', 'Must visit']

  function handleSave() {
    // Optimistic: the view reads notes/priority state, so closing the
    // edit form shows the new values immediately; revert on failure.
    const previous = { notes: item.notes ?? '', priority: item.priority }
    setEditing(false)
    supabase.from('wishlists').update({ notes: notes || null, priority }).eq('id', item.id).then(({ error }) => {
      if (error) { setNotes(previous.notes); setPriority(previous.priority); alert('Couldn’t save your changes — please try again.') }
      else onUpdate()
    })
  }

  function handleRemove() {
    // Optimistic: close now; a failed delete resurfaces on the refetch
    onClose()
    supabase.from('wishlists').delete().eq('id', item.id).then(({ error }) => {
      if (error) alert('Couldn’t remove this place — please try again.')
      onUpdate()
    })
  }

  if (converting) {
    return (
      <ConvertToMemorySheet
        venue={item.venue}
        wishlistId={item.id}
        onClose={() => setConverting(false)}
        onSaved={() => { onUpdate(); onClose() }}
      />
    )
  }

  return (
    <Portal>
      <div className="backdrop-enter fixed z-[60]" style={{ top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(13,79,87,0.4)', backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)' }} onClick={onClose} />
      <div className="fixed z-[70] flex items-start justify-center pointer-events-none" style={{ top: 0, left: 0, right: 0, bottom: 0, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
      <div className="sheet-enter glass-modal relative w-full rounded-3xl overflow-hidden flex flex-col pointer-events-auto"
        style={{ maxHeight: '100%', width: 'min(420px, 100%)' }}>

        {/* Top bar — consistent close button */}
        <div className="flex items-center justify-end px-4 pt-3 pb-1 flex-shrink-0">
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(13,79,87,0.08)', color: 'var(--slate)', fontSize: 14 }}>✕</button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Photo hero — natural aspect ratio, no crop */}
          <div className="overflow-hidden flex-shrink-0" style={{ background: 'var(--stone-200)' }}>
            <PlacePhoto
              placeId={item.venue.google_place_id}
              width={600}
              fallbackInitials={item.venue.name.slice(0, 2).toUpperCase()}
              style={{ width: '100%', height: 'auto', maxHeight: '35vh', objectFit: 'contain', display: 'block' }}
            />
          </div>

          <div className="px-5 pt-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-xl font-semibold leading-tight flex-1 mr-3" style={{ color: 'var(--teal-600)' }}>{item.venue.name}</h2>
              
            </div>
            {item.venue.address && <p className="text-xs mb-1" style={{ color: 'var(--slate)' }}>{item.venue.address}</p>}
            <p className="text-xs mb-4" style={{ color: 'var(--slate-light)' }}>
              Added {new Date(item.added_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>

            {/* Priority badge — reads state so optimistic edits show instantly */}
            {priority > 0 && !editing && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4"
                style={{ background: `${priorityColors[priority]}15`, border: `0.5px solid ${priorityColors[priority]}40` }}>
                <div className="w-2 h-2 rounded-full" style={{ background: priorityColors[priority] }} />
                <span className="text-xs font-semibold" style={{ color: priorityColors[priority] }}>
                  {priorityLabels[priority]}
                </span>
              </div>
            )}

            {/* Notes — reads state so optimistic edits show instantly */}
            {!editing && notes && (
              <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: 'var(--stone-200)', borderLeft: '3px solid var(--gold-500)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--slate)' }}>Why I want to go</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--teal-600)' }}>{notes}</p>
              </div>
            )}

            {/* Edit form */}
            {editing && (
              <div className="mb-4">
                <div className="mb-3">
                  <label className="text-xs font-medium block mb-2" style={{ color: 'var(--slate)' }}>Priority</label>
                  <div className="flex gap-2">
                    {[{ value: 1, label: 'Low', color: 'var(--slate)' }, { value: 2, label: 'Medium', color: 'var(--gold-500)' }, { value: 3, label: 'Must visit', color: 'var(--teal-600)' }].map(opt => (
                      <button key={opt.value} onClick={() => setPriority(opt.value)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold"
                        style={{ background: priority === opt.value ? opt.color : 'var(--stone-200)', color: priority === opt.value ? '#fff' : opt.color }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--slate)' }}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  className="w-full text-sm px-4 py-3 rounded-xl outline-none resize-none"
                  style={{ border: '1.5px solid var(--stone-400)', background: 'var(--stone-100)' }} />
              </div>
            )}
          </div>
        </div>

        {/* Fixed footer */}
        <div className="flex-shrink-0 px-5 pt-3 pb-4" style={{ borderTop: '0.5px solid rgba(13,79,87,0.08)' }}>

          {/* "I've been here" — primary CTA */}
          {!editing && (
            <button onClick={() => setConverting(true)}
              className="press w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 mb-2"
              style={{ background: 'var(--teal-600)', color: 'var(--stone-400)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A86A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              I&apos;ve been here — save a memory
            </button>
          )}

          {/* Secondary actions */}
          <div className="flex gap-2">
            <VenueWebsiteButton placeId={item.venue.google_place_id} venueName={item.venue.name} address={item.venue.address} />
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="flex-1 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                style={{ background: 'var(--stone-200)', color: 'var(--teal-600)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
            ) : (
              <button onClick={handleSave}
                className="press flex-1 py-2.5 rounded-xl text-xs font-semibold"
                style={{ background: 'var(--gold-500)', color: '#fff' }}>
                Save changes
              </button>
            )}
            <button onClick={handleRemove}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium"
              style={{ color: 'var(--danger)', background: 'rgba(163,45,45,0.07)' }}>
              Remove
            </button>
          </div>
        </div>
      </div>
    </div></Portal>
  )
}

function VenueWebsiteButton({ placeId, venueName, address }: { placeId: string | null; venueName: string; address: string | null }) {
  const [website, setWebsite] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  // No placeId means there is no lookup to wait for
  const ready = checked || !placeId

  useEffect(() => {
    if (!placeId) return
    fetch(`/api/venue-details?placeId=${placeId}`)
      .then(r => r.json())
      .then(data => { setWebsite(data.website ?? null); setChecked(true) })
      .catch(() => setChecked(true))
  }, [placeId])

  // Build the best URL available
  const url = website
    ?? `https://www.google.com/search?q=${encodeURIComponent(`${venueName} ${address ?? ''}`.trim())}`

  const label = website ? 'Website' : 'Search Google'

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ background: 'var(--teal-600)', color: 'var(--stone-400)', opacity: ready ? 1 : 0.7, flex: 1, padding: '12px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, textAlign: 'center', display: 'block', lineHeight: 1 }}>
      {ready ? label : '…'}
    </a>
  )
}
