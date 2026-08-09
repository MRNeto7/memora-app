import { Capacitor } from '@capacitor/core'
import { Camera } from '@capacitor/camera'

// Native photo picker (rebuilt shells only). The win over <input
// type="file">: PHPicker dismisses the INSTANT the user confirms, and the
// copy/convert phase runs while our UI is visible — so "Preparing your
// photos…" can actually show. WebKit's file input hard-codes the opposite
// order (copy first, dismiss after) with no page-side hook.
//
// Proper @capacitor imports (not the raw window bridge): registerPlugin
// wires the proxy correctly on Capacitor 8. In plain browsers or shells
// without the plugin, isNativePlatform/isPluginAvailable gate everything
// off and callers fall back to the file input.

export function nativePickerAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Camera')
  } catch {
    return false
  }
}

/**
 * Present the native multi-photo picker; resolves to Files, or null on
 * cancel/failure (callers treat null as "do nothing" — never fall through
 * to the file input, or a cancelling user gets a second picker).
 *
 * No resize/quality options: iOS hands over original bytes so EXIF
 * (GPS + timestamps) survives for grouping and location detection.
 */
export async function pickImagesNatively(): Promise<File[] | null> {
  try {
    const res = await Camera.pickImages({})
    const files: File[] = []
    for (const p of res?.photos ?? []) {
      const src = p.webPath ?? (p.path ? Capacitor.convertFileSrc(p.path) : null)
      if (!src) continue
      const blob = await fetch(src).then(r => (r.ok ? r.blob() : null))
      if (!blob) continue
      const format = (p.format || 'jpeg').toLowerCase()
      files.push(new File([blob], `photo-${files.length + 1}.${format}`, { type: blob.type || `image/${format === 'jpg' ? 'jpeg' : format}` }))
    }
    return files
  } catch {
    return null // user cancelled (plugin rejects) or bridge failure
  }
}
