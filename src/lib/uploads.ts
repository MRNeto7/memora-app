export const MAX_IMAGE_BYTES = 20 * 1024 * 1024 // 20MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024 // 100MB
export const MAX_VIDEO_SECONDS = 15
export const MAX_FILES_PER_SELECTION = 20

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
export async function validateMediaFile(file: File, opts: { allowVideo?: boolean } = {}): Promise<string | null> {
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')

  if (!isImage && !isVideo) return `"${file.name}" isn't a photo or video.`
  if (isVideo && !opts.allowVideo) return `"${file.name}" is a video — only photos are supported here.`

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
  opts: { allowVideo?: boolean } = {}
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
