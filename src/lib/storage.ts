import type { createClient } from '@/lib/supabase/client'
import { getBlob, putBlob } from '@/lib/imageCache'

type Supabase = ReturnType<typeof createClient>

/* ── Offline blob layer ──────────────────────────────
   Images render from the IndexedDB cache when available (works in
   airplane mode), and every image served from the network is cached
   in the background. Object URLs are kept for the session — small,
   bounded by the photo count, and revoking mid-render breaks <img>. */

const objectUrls = new Map<string, string>()
const blobFetchInFlight = new Set<string>()
const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i

async function fromBlobCache(path: string): Promise<string | null> {
  const existing = objectUrls.get(path)
  if (existing) return existing
  const blob = await getBlob(path)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  objectUrls.set(path, url)
  return url
}

function cacheBlobInBackground(path: string, url: string) {
  if (typeof window === 'undefined' || VIDEO_RE.test(path) || blobFetchInFlight.has(path)) return
  blobFetchInFlight.add(path)
  void fetch(url)
    .then(async r => { if (r.ok) await putBlob(path, await r.blob()) })
    .catch(() => { blobFetchInFlight.delete(path) }) // retry later if it failed
}

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
  const offline = await fromBlobCache(path)
  if (offline) return offline

  const cached = getCached(path)
  if (cached) { cacheBlobInBackground(path, cached); return cached }

  const { data } = await supabase.storage.from('memory-photos').createSignedUrl(path, SIGN_TTL_SECONDS)
  if (!data?.signedUrl) return null
  memoryCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGN_TTL_SECONDS * 1000 })
  persistToSession()
  cacheBlobInBackground(path, data.signedUrl)
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
 * Working URL for a photo's thumbnail, falling back to the full image
 * when no thumb exists (uploads that predate thumbnails). Own photos
 * get their thumb quietly backfilled in the background so the map
 * gets faster with use.
 *
 * Signed URLs are NOT trusted blindly: Supabase signs paths without
 * checking the object exists (the batch endpoint especially), so a
 * pre-thumbnail photo gets a validly-signed URL that 404s and renders
 * a blank <img>. The thumb's pixels are fetched here — success feeds
 * the offline cache; failure means "no thumb yet" → backfill + full
 * image, and the dead cache entry is scrubbed.
 */
export async function getThumbUrl(supabase: Supabase, path: string): Promise<string | null> {
  const tp = thumbPath(path)
  const offline = await fromBlobCache(tp)
  if (offline) return offline

  let url = getCached(tp)
  if (!url) {
    const { data } = await supabase.storage.from('memory-photos').createSignedUrl(tp, SIGN_TTL_SECONDS)
    if (data?.signedUrl) {
      url = data.signedUrl
      memoryCache.set(tp, { url, expiresAt: Date.now() + SIGN_TTL_SECONDS * 1000 })
      persistToSession()
    }
  }

  if (url) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const blob = await res.blob()
        void putBlob(tp, blob)
        const obj = URL.createObjectURL(blob)
        objectUrls.set(tp, obj)
        return obj
      }
      // Signed-but-missing object — drop the poisoned entry so a future
      // call re-checks after the backfill lands.
      memoryCache.delete(tp)
      persistToSession()
    } catch {
      // Network failure (offline, blocked) — the signed URL may still
      // work in an <img>, so serve it rather than falling to full size.
      return url
    }
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
    void putBlob(thumbPath(path), thumb) // freshly generated — cache it locally too
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
        // Pull the pixels into the offline cache too (browser caps
        // concurrency per host, so firing all of these is fine)
        cacheBlobInBackground(item.path, item.signedUrl)
      }
    }
    persistToSession()
  }
  return result
}
