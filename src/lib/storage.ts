import type { createClient } from '@/lib/supabase/client'

type Supabase = ReturnType<typeof createClient>

// Signed URLs must stay stable across page navigations: a fresh URL has a
// fresh token, which defeats the browser's HTTP cache and re-downloads every
// photo from Supabase (slow + egress costs). Cache them in memory and
// sessionStorage, and only re-sign when one is close to expiring.
const SIGN_TTL_SECONDS = 60 * 60 * 24 // 24h
const REFRESH_MARGIN_MS = 60 * 60 * 1000 // re-sign when <1h of validity left
const STORAGE_KEY = 'memora-signed-urls-v1'

interface CachedUrl { url: string; expiresAt: number }

const memoryCache = new Map<string, CachedUrl>()
let restored = false

function restoreFromSession() {
  if (restored || typeof window === 'undefined') return
  restored = true
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const entries: Record<string, CachedUrl> = JSON.parse(raw)
    const now = Date.now()
    for (const [path, entry] of Object.entries(entries)) {
      if (entry.expiresAt - REFRESH_MARGIN_MS > now) memoryCache.set(path, entry)
    }
  } catch { /* corrupt cache — start fresh */ }
}

function persistToSession() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(memoryCache)))
  } catch { /* storage full or unavailable — cache still works in memory */ }
}

function getCached(path: string): string | null {
  restoreFromSession()
  const entry = memoryCache.get(path)
  if (entry && entry.expiresAt - REFRESH_MARGIN_MS > Date.now()) return entry.url
  return null
}

export async function getSignedPhotoUrl(supabase: Supabase, path: string): Promise<string | null> {
  const cached = getCached(path)
  if (cached) return cached

  const { data } = await supabase.storage.from('memory-photos').createSignedUrl(path, SIGN_TTL_SECONDS)
  if (!data?.signedUrl) return null
  memoryCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGN_TTL_SECONDS * 1000 })
  persistToSession()
  return data.signedUrl
}

/* ── Thumbnails ──────────────────────────────────────
   Thumbs live at {user}/{memory}/thumbs/{file} — derived by convention,
   no schema change, and the existing storage policies still apply
   (folder[1] = owner, folder[2] = memory id). */

export function thumbPath(path: string): string {
  const i = path.lastIndexOf('/')
  return `${path.slice(0, i)}/thumbs${path.slice(i)}`
}

// One backfill attempt per path per session — avoids retry loops on
// videos and other files that can never have a thumb.
const backfillAttempted = new Set<string>()

/**
 * Signed URL for a photo's thumbnail, falling back to the full image
 * when no thumb exists (uploads that predate thumbnails). Own photos
 * get their thumb quietly backfilled in the background so the map
 * gets faster with use.
 */
export async function getThumbUrl(supabase: Supabase, path: string): Promise<string | null> {
  const tp = thumbPath(path)
  const cached = getCached(tp)
  if (cached) return cached

  const { data } = await supabase.storage.from('memory-photos').createSignedUrl(tp, SIGN_TTL_SECONDS)
  if (data?.signedUrl) {
    memoryCache.set(tp, { url: data.signedUrl, expiresAt: Date.now() + SIGN_TTL_SECONDS * 1000 })
    persistToSession()
    return data.signedUrl
  }

  void backfillThumb(supabase, path)
  return getSignedPhotoUrl(supabase, path)
}

async function backfillThumb(supabase: Supabase, path: string) {
  if (backfillAttempted.has(path) || typeof window === 'undefined') return
  backfillAttempted.add(path)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !path.startsWith(`${user.id}/`)) return // storage RLS: own folder only
    const url = await getSignedPhotoUrl(supabase, path)
    if (!url) return
    const res = await fetch(url)
    if (!res.ok) return
    const blob = await res.blob()
    const { makeThumbnail } = await import('@/lib/images')
    const thumb = await makeThumbnail(new File([blob], path.split('/').pop() ?? 'photo.jpg', { type: blob.type || 'image/jpeg' }))
    if (!thumb) return
    await supabase.storage.from('memory-photos').upload(thumbPath(path), thumb, { upsert: true, contentType: thumb.type })
  } catch { /* best-effort — the full image already rendered */ }
}

/** Sign many paths in one round-trip; returns a path → url map. */
export async function getSignedPhotoUrls(supabase: Supabase, paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const missing: string[] = []

  for (const path of paths) {
    const cached = getCached(path)
    if (cached) result.set(path, cached)
    else missing.push(path)
  }

  if (missing.length > 0) {
    const { data } = await supabase.storage.from('memory-photos').createSignedUrls(missing, SIGN_TTL_SECONDS)
    const expiresAt = Date.now() + SIGN_TTL_SECONDS * 1000
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) {
        result.set(item.path, item.signedUrl)
        memoryCache.set(item.path, { url: item.signedUrl, expiresAt })
      }
    }
    persistToSession()
  }
  return result
}
