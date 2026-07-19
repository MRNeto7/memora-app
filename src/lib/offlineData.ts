import type { createClient } from '@/lib/supabase/client'

type Supabase = ReturnType<typeof createClient>

// Snapshot cache for fetched lists (memories, wishlist) so the app renders
// instantly on open and keeps working offline. Stale-while-revalidate:
// consumers hydrate from here on mount, then refresh from the network and
// save back. Envelopes are scoped to the signed-in user so nothing leaks
// across accounts on a shared device.

interface Envelope<T> { userId: string; savedAt: number; data: T }

export const CACHE_KEYS = {
  memories: 'memora-cache-memories-v1',
  wishlistMap: 'memora-cache-wishlist-map-v1',
  wishlistList: 'memora-cache-wishlist-list-v1',
} as const

async function currentUserId(supabase: Supabase): Promise<string | null> {
  // getSession reads the local JWT — works offline, unlike getUser()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

export async function loadCached<T>(supabase: Supabase, key: string): Promise<T | null> {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const env: Envelope<T> = JSON.parse(raw)
    const uid = await currentUserId(supabase)
    if (!uid || env.userId !== uid) return null
    return env.data
  } catch {
    return null
  }
}

export async function saveCached<T>(supabase: Supabase, key: string, data: T): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const uid = await currentUserId(supabase)
    if (!uid) return
    window.localStorage.setItem(key, JSON.stringify({ userId: uid, savedAt: Date.now(), data }))
  } catch {
    // localStorage full — the app just falls back to network-only
  }
}
