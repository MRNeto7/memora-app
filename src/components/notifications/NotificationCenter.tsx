'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NotificationItem } from '@/lib/notifications'
import Icon from '@/components/ui/Icon'
import Portal from '@/components/ui/Portal'
import TaggedMemorySheet from '@/components/memory/TaggedMemorySheet'

type TaggedItem = Extract<NotificationItem, { kind: 'tagged' }>

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function NotificationCenter({ items, loading, onClose, onChanged }: {
  items: NotificationItem[]
  loading: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [viewTag, setViewTag] = useState<TaggedItem | null>(null)

  async function respond(requestId: string, accept: boolean) {
    await supabase.from('friend_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('id', requestId)
    onChanged()
  }

  return (
    <Portal>
      <div className="backdrop-enter fixed z-[60]" style={{ top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(13,79,87,0.4)', backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)' }} onClick={onClose} />
      <div className="fixed z-[70] flex items-start justify-center pointer-events-none" style={{ top: 0, left: 0, right: 0, bottom: 0, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        <div className="sheet-enter relative w-full bg-white rounded-3xl overflow-hidden flex flex-col pointer-events-auto" style={{ maxHeight: '82vh', width: 'min(420px, 100%)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '0.5px solid rgba(13,79,87,0.08)' }}>
            <h2 className="font-semibold text-base" style={{ color: '#0D4F57' }}>Notifications</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(13,79,87,0.08)', color: '#7D878D', fontSize: 14 }}>✕</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-center py-12" style={{ color: '#7D878D' }}>Loading…</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center text-center py-14 px-6">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: '#f5f2ed' }}>
                  <Icon name="bell" size={22} color="#C9A86A" />
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: '#0D4F57' }}>You&apos;re all caught up</p>
                <p className="text-xs" style={{ color: '#7D878D' }}>Friend requests and memory throwbacks will show here.</p>
              </div>
            ) : (
              items.map(item => (
                <div key={item.id} className="flex items-start gap-3 px-5 py-3.5" style={{ borderBottom: '0.5px solid rgba(13,79,87,0.05)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#f5f2ed' }}>
                    <Icon name={item.kind === 'friend_request' ? 'friend-add' : item.kind === 'friend_accepted' ? 'friend-check' : item.kind === 'tagged' ? 'pin' : 'camera'} size={16} color="#0D4F57" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {item.kind === 'friend_request' && (
                      <>
                        <p className="text-sm" style={{ color: '#0D4F57' }}><span className="font-semibold">{item.name}</span> wants to add you</p>
                        <p className="text-xs mt-0.5 mb-2" style={{ color: '#b0babe' }}>{timeAgo(item.at)}</p>
                        <div className="flex gap-2">
                          <button onClick={() => respond(item.requestId, true)} className="press px-4 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#0D4F57', color: '#EAE5DD' }}>Accept</button>
                          <button onClick={() => respond(item.requestId, false)} className="press px-4 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#f5f2ed', color: '#7D878D' }}>Decline</button>
                        </div>
                      </>
                    )}
                    {item.kind === 'friend_accepted' && (
                      <button onClick={() => { onClose(); router.push('/social') }} className="text-left w-full">
                        <p className="text-sm" style={{ color: '#0D4F57' }}><span className="font-semibold">{item.name}</span> accepted your friend request</p>
                        <p className="text-xs mt-0.5" style={{ color: '#b0babe' }}>{timeAgo(item.at)}</p>
                      </button>
                    )}
                    {item.kind === 'anniversary' && (
                      <button onClick={() => { onClose(); router.push('/memories') }} className="text-left w-full">
                        <p className="text-xs font-semibold" style={{ color: '#C9A86A' }}>On this day · {item.yearsAgo} {item.yearsAgo === 1 ? 'year' : 'years'} ago</p>
                        <p className="text-sm" style={{ color: '#0D4F57' }}>{item.title}</p>
                      </button>
                    )}
                    {item.kind === 'tagged' && (
                      <button onClick={() => setViewTag(item)} className="text-left w-full">
                        <p className="text-sm" style={{ color: '#0D4F57' }}>
                          <span className="font-semibold">{item.taggerName}</span> tagged you in a memory{item.venueName ? <> at <span className="font-semibold">{item.venueName}</span></> : ''}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#b0babe' }}>{timeAgo(item.at)}</p>
                        <p className="text-xs mt-1 font-semibold" style={{ color: '#C9A86A' }}>Tap to view and save your copy</p>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tagged-memory preview + save-a-copy flow */}
      {viewTag && (
        <TaggedMemorySheet
          tagId={viewTag.tagId}
          memoryId={viewTag.memoryId}
          taggerName={viewTag.taggerName}
          onClose={() => setViewTag(null)}
          onChanged={() => { setViewTag(null); onChanged() }}
        />
      )}
    </Portal>
  )
}
