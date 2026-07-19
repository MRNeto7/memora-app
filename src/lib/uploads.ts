import type { createClient } from '@/lib/supabase/client'
import { compressImage, makeThumbnail } from '@/lib/images'
import { thumbPath } from '@/lib/storage'

type Supabase = ReturnType<typeof createClient>

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024 // 20MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB — caps Supabase storage; 15s cap below bounds it further
export const MAX_VIDEO_SECONDS = 15
export const MAX_FILES_PER_SELECTION = 20

/**
 * Compress and upload a photo plus its thumbnail (thumb is best-effort —
 * consumers fall back to the full image). Returns the storage path of the
 * full image, or null if that upload failed.
 */
export async function uploadPhotoWithThumb(
  supabase: Supabase, userId: string, memoryId: string, file: File
): Promise<string | null> {
  const upload = await compressImage(file)
  const ext = upload.name.split('.').pop()
  const path = `${userId}/${memoryId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('memory-photos').upload(path, upload, { upsert: true, contentType: upload.type })
  if (error) return null
  const thumb = await makeThumbnail(upload)
  if (thumb) await supabase.storage.from('memory-photos').upload(thumbPath(path), thumb, { upsert: true, contentType: thumb.type })
  return path
}

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => { window.URL.revokeObjectURL(video.src); resolve(video.duration) }
    video.onerror = () => resolve(0)
    video.src = URL.createObjectURL(file)
  })
}

/** Returns a user-facing rejection reason, or null if the file is acceptable. */
export async function validateMediaFile(file: File, opts: { allowVideo?: boolean; videoRejectionMessage?: string } = {}): Promise<string | null> {
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')

  if (!isImage && !isVideo) return `"${file.name}" isn't a photo or video.`
  if (isVideo && !opts.allowVideo) return opts.videoRejectionMessage ?? `"${file.name}" is a video — only photos are supported here.`

  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}" is too large — photos must be under ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`
  }
  if (isVideo) {
    if (file.size > MAX_VIDEO_BYTES) {
      return `"${file.name}" is too large — videos must be under ${MAX_VIDEO_BYTES / 1024 / 1024}MB.`
    }
    const duration = await getVideoDuration(file)
    if (duration > MAX_VIDEO_SECONDS) {
      return `"${file.name}" is ${Math.round(duration)}s — videos must be ${MAX_VIDEO_SECONDS} seconds or under.`
    }
  }
  return null
}

/**
 * Splits a selection into accepted files and rejection reasons,
 * enforcing the per-selection count cap.
 */
export async function filterMediaFiles(
  files: File[],
  opts: { allowVideo?: boolean; videoRejectionMessage?: string } = {}
): Promise<{ accepted: File[]; rejected: string[] }> {
  const accepted: File[] = []
  const rejected: string[] = []

  for (const file of files) {
    if (accepted.length >= MAX_FILES_PER_SELECTION) {
      rejected.push(`Only the first ${MAX_FILES_PER_SELECTION} files were added.`)
      break
    }
    const reason = await validateMediaFile(file, opts)
    if (reason) rejected.push(reason)
    else accepted.push(file)
  }
  return { accepted, rejected }
}
