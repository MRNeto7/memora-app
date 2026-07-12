import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Notifications are derived live from existing tables (no notifications
// table yet) — incoming friend requests, requests that got accepted, and
// "on this day" memory anniversaries. Unread state is tracked locally.
export type NotificationItem =
  | { id: string; kind: 'friend_request'; requestId: string; fromUserId: string; name: string; at: string }
  | { id: string; kind: 'friend_accepted'; name: string; at: string }
  | { id: string; kind: 'anniversary'; memoryId: string; title: string; yearsAgo: number; at: string }
  | { id: string; kind: 'tagged'; tagId: string; memoryId: string; taggerName: string; venueName: string | null; at: string }

const SEEN_KEY = 'mimora_seen_notifications_v1'

function getSeen(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try { return new Set<string>(JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '[]')) }
  catch { return new Set() }
}

function addSeen(ids: string[]) {
  if (typeof window === 'undefined' || ids.length === 0) return
  const seen = getSeen()
  ids.forEach(id => seen.add(id))
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])) } catch { /* storage full */ }
}

// A pending friend request or memory tag is always "unread" — it needs a
// response. Everything else is unread until the user opens the center.
function isUnread(item: NotificationItem, seen: Set<string>): boolean {
  return item.kind === 'friend_request' || item.kind === 'tagged' || !seen.has(item.id)
}

export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [seenVersion, setSeenVersion] = useState(0)

  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) { setItems([]); setLoading(false) } return }

      const now = new Date()
      const result: NotificationItem[] = []

      // Incoming pending friend requests
      const { data: incoming } = await supabase
        .from('friend_requests')
        .select('id, from_user_id, created_at, from_user:users!from_user_id(display_name, memora_id)')
        .eq('to_user_id', user.id)
        .eq('status', 'pending')
      for (const r of incoming ?? []) {
        const name = r.from_user?.display_name || r.from_user?.memora_id || 'Someone'
        result.push({ id: `fr_${r.id}`, kind: 'friend_request', requestId: r.id, fromUserId: r.from_user_id, name, at: r.created_at })
      }

      // Your outgoing requests that were accepted in the last 30 days
      const { data: accepted } = await supabase
        .from('friend_requests')
        .select('id, updated_at, to_user:users!to_user_id(display_name, memora_id)')
        .eq('from_user_id', user.id)
        .eq('status', 'accepted')
        .order('updated_at', { ascending: false })
        .limit(20)
      for (const r of accepted ?? []) {
        const ageDays = (now.getTime() - new Date(r.updated_at).getTime()) / 86_400_000
        if (ageDays > 30) continue
        const name = r.to_user?.display_name || r.to_user?.memora_id || 'Someone'
        result.push({ id: `acc_${r.id}`, kind: 'friend_accepted', name, at: r.updated_at })
      }

      // Pending memory tags — a friend tagged you; you can save your own copy.
      // Errors are ignored so this no-ops until migration 007 is applied.
      const { data: tagRows } = await supabase
        .from('memory_tags')
        .select('id, memory_id, created_at, tagger:users!tagger_id(display_name, memora_id), memory:memories!memory_id(venue:venues(name))')
        .eq('tagged_user_id', user.id)
        .eq('status', 'pending')
      for (const t of tagRows ?? []) {
        const taggerName = t.tagger?.display_name || t.tagger?.memora_id || 'A friend'
        result.push({
          id: `tag_${t.id}`,
          kind: 'tagged',
          tagId: t.id,
          memoryId: t.memory_id,
          taggerName,
          venueName: t.memory?.venue?.name ?? null,
          at: t.created_at,
        })
      }

      // On this day — memories from the same calendar day in a previous year
      const { data: memories } = await supabase
        .from('memories')
        .select('id, visited_at, dish_name, venue:venues(name)')
        .eq('user_id', user.id)
      const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      for (const m of memories ?? []) {
        const d = new Date(m.visited_at)
        if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() < now.getFullYear()) {
          result.push({
            id: `anniv_${m.id}_${now.getFullYear()}`,
            kind: 'anniversary',
            memoryId: m.id,
            title: m.venue?.name || m.dish_name || 'A memory',
            yearsAgo: now.getFullYear() - d.getFullYear(),
            at: todayKey,
          })
        }
      }

      result.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      if (!cancelled) { setItems(result); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [reloadKey])

  const seen = getSeen()
  void seenVersion // re-read seen after markAllSeen
  const unreadCount = items.filter(i => isUnread(i, seen)).length

  const markAllSeen = useCallback(() => {
    addSeen(items.filter(i => i.kind !== 'friend_request' && i.kind !== 'tagged').map(i => i.id))
    setSeenVersion(v => v + 1)
  }, [items])

  return { items, loading, unreadCount, reload, markAllSeen }
}
