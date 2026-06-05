'use client'

import { APIProvider } from '@vis.gl/react-google-maps'

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!

export default function MapsProvider({ children }: { children: React.ReactNode }) {
  return (
    <APIProvider apiKey={MAPS_KEY} libraries={['places']}>
      {children}
    </APIProvider>
  )
}
