'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PlacePhoto from '@/components/ui/PlacePhoto'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [priority, setPriority] = useState(item.priority)
  const [saving, setSaving] = useState(false)

  const priorityColors = ['', '#b0babe', '#C9A86A', '#0D4F57']
  const priorityLabels = ['', 'Low', 'Medium', 'Must visit']

  async function handleSave() {
    setSaving(true)
    await supabase.from('wishlists').update({ notes: notes || null, priority }).eq('id', item.id)
    setSaving(false)
    setEditing(false)
    onUpdate()
  }

  async function handleRemove() {
    await supabase.from('wishlists').delete().eq('id', item.id)
    onUpdate()
    onClose()
  }

  return (
    <>
      <div className="absolute inset-0 z-20" style={{ background: 'rgba(13,79,87,0.4)' }} onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl" style={{ maxHeight: '85vh', overflowY: 'auto', paddingBottom: 40 }}>
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full" style={{ background: '#EAE5DD' }} /></div>
        <div className="px-5 pt-1">

          {/* Restaurant photo hero */}
          {item.venue.google_place_id && (
            <div className="-mx-5 mb-5 overflow-hidden" style={{ height: 200 }}>
              <PlacePhoto
                placeId={item.venue.google_place_id}
                width={600}
                fallbackInitials={item.venue.name.slice(0, 2).toUpperCase()}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}

          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-xl font-semibold leading-tight flex-1 mr-3" style={{ color: '#0D4F57' }}>{item.venue.name}</h2>
            <button onClick={onClose} style={{ color: '#7D878D', fontSize: 18, marginTop: 2 }}>✕</button>
          </div>
          {item.venue.address && <p className="text-xs mb-1" style={{ color: '#7D878D' }}>{item.venue.address}</p>}
          <p className="text-xs mb-4" style={{ color: '#b0babe' }}>
            Added {new Date(item.added_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>

          {/* Priority badge */}
          {item.priority > 0 && !editing && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4"
              style={{ background: `${priorityColors[item.priority]}15`, border: `0.5px solid ${priorityColors[item.priority]}40` }}>
              <div className="w-2 h-2 rounded-full" style={{ background: priorityColors[item.priority] }} />
              <span className="text-xs font-semibold" style={{ color: priorityColors[item.priority] }}>
                {priorityLabels[item.priority]}
              </span>
            </div>
          )}

          {/* Notes */}
          {!editing && item.notes && (
            <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: '#f5f2ed', borderLeft: '3px solid #C9A86A' }}>
              <p className="text-xs mb-1" style={{ color: '#7D878D' }}>Why I want to go</p>
              <p className="text-sm leading-relaxed" style={{ color: '#0D4F57' }}>{item.notes}</p>
            </div>
          )}

          {/* Edit form */}
          {editing && (
            <div className="mb-4">
              <div className="mb-3">
                <label className="text-xs font-medium block mb-2" style={{ color: '#7D878D' }}>Priority</label>
                <div className="flex gap-2">
                  {[{ value: 1, label: 'Low', color: '#b0babe' }, { value: 2, label: 'Medium', color: '#C9A86A' }, { value: 3, label: 'Must visit', color: '#0D4F57' }].map(opt => (
                    <button key={opt.value} onClick={() => setPriority(opt.value)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: priority === opt.value ? opt.color : '#f5f2ed', color: priority === opt.value ? '#fff' : opt.color }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full text-sm px-4 py-3 rounded-xl outline-none resize-none"
                style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mb-3">
            {item.venue.google_place_id && (
              <a href={`https://www.google.com/maps/place/?q=place_id:${item.venue.google_place_id}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5"
                style={{ background: '#0D4F57', color: '#EAE5DD' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/></svg>
                View on Maps
              </a>
            )}
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                style={{ background: '#f5f2ed', color: '#0D4F57' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                style={{ background: '#C9A86A', color: '#fff' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>

          <button onClick={handleRemove}
            className="w-full py-2.5 rounded-xl text-xs font-medium"
            style={{ color: '#a32d2d', background: 'rgba(163,45,45,0.07)' }}>
            Remove from wishlist
          </button>
        </div>
      </div>
    </>
  )
}
