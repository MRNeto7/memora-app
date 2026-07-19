const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82
const SKIP_BELOW_BYTES = 400 * 1024 // already small — not worth re-encoding

const THUMB_DIMENSION = 320 // covers the largest thumb use (84px) at 3x retina
const THUMB_QUALITY = 0.72

/**
 * Tiny JPEG (~10-15KB) for pins and list cards, generated alongside the
 * full upload. Returns null for videos or undecodable files — callers
 * skip the thumb and consumers fall back to the full image.
 */
export async function makeThumbnail(file: File): Promise<File | null> {
  if (!file.type.startsWith('image/')) return null
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, THUMB_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', THUMB_QUALITY)
    )
    if (!blob) return null
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return null
  }
}

/**
 * Downscales and re-encodes an image to a phone-screen-sized JPEG before
 * upload. A 10MB camera photo becomes ~300KB, cutting storage and (more
 * importantly) download egress by ~20-30x. Videos and small files pass
 * through untouched; any decode failure falls back to the original file.
 *
 * Note: re-encoding strips EXIF, so callers must extract GPS/date metadata
 * (readPhotoExif) BEFORE compressing.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size < SKIP_BELOW_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    )
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    // Unsupported format (e.g. HEIC in some browsers) — upload the original
    return file
  }
}
