import exifr from 'exifr'

export interface ExifData {
  lat: number | null
  lng: number | null
  takenAt: Date | null
  hasExif: boolean
  hasLocation: boolean
  wasStripped: boolean // true if EXIF exists but no GPS data (likely stripped by social app)
}

export async function readPhotoExif(file: File): Promise<ExifData> {
  try {
    const data = await exifr.parse(file, {
      gps: true,
      tiff: true,
      exif: true,
    })

    const hasExif = !!data
    const hasLocation = !!(data?.latitude && data?.longitude)
    const wasStripped = hasExif && !hasLocation

    return {
      lat: data?.latitude ?? null,
      lng: data?.longitude ?? null,
      takenAt: data?.DateTimeOriginal ?? data?.DateTime ?? null,
      hasExif,
      hasLocation,
      wasStripped,
    }
  } catch {
    // No EXIF at all
    return {
      lat: null,
      lng: null,
      takenAt: null,
      hasExif: false,
      hasLocation: false,
      wasStripped: false,
    }
  }
}

export function getExifMessage(exif: ExifData): string | null {
  if (exif.hasLocation) return null // all good, no message needed

  if (exif.wasStripped) {
    return "This photo's location was removed — this usually happens when sharing via WhatsApp or social media. Type the location below and we'll pin it for you."
  }

  if (!exif.hasExif) {
    return "We couldn't read location data from this photo. This is usually because Location Access is off for your Camera app. You can enable it in Settings → Privacy → Location Services → Camera. Or just type the location below."
  }

  return "No location found in this photo. Type the location below to pin your memory."
}

// Fuzz coordinates for public memories (~1km radius)
export function fuzzCoordinates(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
  }
}
