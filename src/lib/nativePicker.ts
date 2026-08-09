import { Capacitor } from '@capacitor/core'
import { Camera } from '@capacitor/camera'
import { Filesystem } from '@capacitor/filesystem'

// Native photo picker (rebuilt shells only). The win over <input
// type="file">: PHPicker dismisses the INSTANT the user confirms, and the
// copy/convert phase runs while our UI is visible — so "Preparing your
// photos…" can actually show.
//
// File access caveat: this app loads from a REMOTE https origin, which is
// forbidden from fetch()ing the capacitor:// scheme that webPath uses —
// so picked files are read through the Filesystem plugin (base64 over the
// bridge). Both plugins are therefore required before the native path
// switches on; older shells keep the file-input flow.

export function nativePickerAvailable(): boolean {
  try {
    return (
      Capacitor.isNativePlatform() &&
      Capacitor.isPluginAvailable('Camera') &&
      Capacitor.isPluginAvailable('Filesystem')
    )
  } catch {
    return false
  }
}

function mimeFor(format: string): string {
  const f = format.toLowerCase()
  return `image/${f === 'jpg' ? 'jpeg' : f}`
}

async function fileFromPicked(p: { webPath?: string; path?: string; format?: string }, index: number): Promise<File | null> {
  const format = (p.format || 'jpeg').toLowerCase()
  const name = `photo-${index}.${format}`

  // First choice: direct fetch — works when the app is served from the
  // capacitor origin (kept for a future local-serving setup).
  if (p.webPath) {
    try {
      const r = await fetch(p.webPath)
      if (r.ok) {
        const blob = await r.blob()
        return new File([blob], name, { type: blob.type || mimeFor(format) })
      }
    } catch { /* remote-origin shell — cross-scheme fetch is blocked */ }
  }

  // Remote-URL path: bytes via the Filesystem bridge.
  if (p.path) {
    try {
      const { data } = await Filesystem.readFile({ path: p.path })
      if (typeof data === 'string') {
        const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
        return new File([bytes], name, { type: mimeFor(format) })
      }
      return new File([data], name, { type: mimeFor(format) })
    } catch { return null }
  }
  return null
}

/**
 * Present the native multi-photo picker; resolves to Files, null on
 * cancel/bridge failure, or an empty array if photos were picked but none
 * could be read (callers should surface that as an error).
 *
 * No resize/quality options: iOS hands over original bytes so EXIF
 * (GPS + timestamps) survives for grouping and location detection.
 */
export async function pickImagesNatively(): Promise<File[] | null> {
  try {
    const res = await Camera.pickImages({})
    const photos = res?.photos ?? []
    const files: File[] = []
    for (let i = 0; i < photos.length; i++) {
      const file = await fileFromPicked(photos[i], i + 1)
      if (file) files.push(file)
    }
    return files
  } catch {
    return null // user cancelled (plugin rejects) or bridge failure
  }
}
