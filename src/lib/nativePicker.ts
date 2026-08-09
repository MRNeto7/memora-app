// Native photo picker via the Capacitor bridge, when the rebuilt shell
// registers the Camera plugin. The win over <input type="file">: PHPicker
// dismisses the INSTANT the user confirms, and the copy/convert phase runs
// while our UI is visible — so "Preparing your photos…" can actually show.
// (WebKit's file input hard-codes the opposite order: copy first, dismiss
// after, page told nothing meanwhile.)
//
// Accessed through window.Capacitor rather than an @capacitor/core import
// so the web bundle stays byte-identical for shells that predate the
// plugin; callers must check nativePickerAvailable() first and keep the
// file-input path as fallback.

interface CapacitorBridge {
  isPluginAvailable?: (name: string) => boolean
  Plugins?: {
    Camera?: {
      pickImages: (opts: Record<string, unknown>) => Promise<{ photos?: { webPath?: string; format?: string }[] }>
    }
  }
}

function bridge(): CapacitorBridge | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor
}

export function nativePickerAvailable(): boolean {
  return Boolean(bridge()?.isPluginAvailable?.('Camera'))
}

/**
 * Present the native multi-photo picker and return the picked images as
 * Files. Returns null on cancel or failure — callers should treat null as
 * "do nothing" (never fall back to the file input mid-flow, or the user
 * who cancelled gets a second picker).
 *
 * No resize/quality options are passed so iOS hands over the original
 * bytes — EXIF (GPS + timestamps) must survive for grouping and location
 * detection.
 */
export async function pickImagesNatively(): Promise<File[] | null> {
  const Camera = bridge()?.Plugins?.Camera
  if (!Camera) return null
  try {
    const res = await Camera.pickImages({})
    const files: File[] = []
    for (const p of res?.photos ?? []) {
      if (!p.webPath) continue
      const blob = await fetch(p.webPath).then(r => (r.ok ? r.blob() : null))
      if (!blob) continue
      const format = (p.format || 'jpeg').toLowerCase()
      const ext = format === 'jpg' ? 'jpeg' : format
      files.push(new File([blob], `photo-${files.length + 1}.${format}`, { type: blob.type || `image/${ext}` }))
    }
    return files
  } catch {
    return null // user cancelled (plugin rejects) or bridge failure
  }
}
