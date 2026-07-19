'use client'

import { toast } from '@/lib/toast'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

export interface Friend { id: string; name: string }

// Accepted friends of the signed-in user (same lookup as the social page)
export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: reqs } = await supabase
        .from('friend_requests')
        .select('from_user_id, to_user_id')
        .eq('status', 'accepted')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      const ids = [...new Set((reqs ?? []).map(r => r.from_user_id === user.id ? r.to_user_id : r.from_user_id))]
      if (ids.length === 0) return
      const { data: profiles } = await supabase.from('users').select('id, display_name, memora_id').in('id', ids)
      if (!cancelled && profiles) {
        setFriends(profiles.map(p => ({ id: p.id, name: p.display_name || p.memora_id || 'Friend' })))
      }
    })()
    return () => { cancelled = true }
  }, [])

  return friends
}

// Toggleable friend chips — shared by the add-mode picker and the
// tag section on saved memories.
export function FriendChips({ friends, selected, onToggle }: {
  friends: Friend[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {friends.map(f => {
        const on = selected.has(f.id)
        return (
          <button key={f.id} type="button" onClick={() => onToggle(f.id)}
            className="press flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: on ? 'var(--stone-200)' : '#fff',
              color: on ? 'var(--teal-600)' : 'var(--slate)',
              border: on ? '0.5px solid var(--teal-600)' : '0.5px solid rgba(16,20,22,0.12)',
            }}>
            {on && <Icon name="check" size={11} color="var(--gold-500)" strokeWidth={2.5} />}
            {f.name}
          </button>
        )
      })}
    </div>
  )
}

interface TagRow { id: string; tagged_user_id: string; status: 'pending' | 'saved' | 'dismissed' }

// Tag friends on a saved memory (own memories only — inserts are also
// RLS-gated to the memory owner + accepted friends).
export default function TagFriendsSection({ memoryId }: { memoryId: string }) {
  const supabase = createClient()
  const friends = useFriends()
  const [tags, setTags] = useState<TagRow[]>([])
  // Fail soft if migration 007 hasn't been applied yet
  const [available, setAvailable] = useState(true)

  async function loadTags() {
    const { data, error } = await supabase
      .from('memory_tags')
      .select('id, tagged_user_id, status')
      .eq('memory_id', memoryId)
    if (error) { setAvailable(false); return }
    setTags(data ?? [])
  }

  useEffect(() => {
    loadTags()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoryId])

  if (!available || friends.length === 0) return null

  const taggedIds = new Set(tags.map(t => t.tagged_user_id))

  async function toggle(friendId: string) {
    const existing = tags.find(t => t.tagged_user_id === friendId)
    if (existing) {
      // Optimistic untag; reload restores it if the delete fails
      setTags(prev => prev.filter(t => t.id !== existing.id))
      const { error } = await supabase.from('memory_tags').delete().eq('id', existing.id)
      if (error) { loadTags(); toast('Couldn’t remove the tag — please try again.', 'error') }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('memory_tags')
        .insert({ memory_id: memoryId, tagger_id: user.id, tagged_user_id: friendId })
        .select('id, tagged_user_id, status')
        .single()
      if (error || !data) toast('Couldn’t tag your friend — please try again.', 'error')
      else setTags(prev => [...prev, data])
    }
  }

  const savedNames = tags
    .filter(t => t.status === 'saved')
    .map(t => friends.find(f => f.id === t.tagged_user_id)?.name)
    .filter(Boolean)

  return (
    <div className="mb-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--stone-200)' }}>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--teal-600)' }}>Tag friends</p>
      <FriendChips friends={friends} selected={taggedIds} onToggle={toggle} />
      {savedNames.length > 0 && (
        <p className="text-xs mt-2 flex items-center gap-1" style={{ color: 'var(--slate)' }}>
          <Icon name="check" size={11} color="var(--gold-500)" strokeWidth={2.5} />
          {savedNames.join(', ')} saved this to their profile
        </p>
      )}
    </div>
  )
}
