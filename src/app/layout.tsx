import type { Metadata, Viewport } from 'next'
import './globals.css'
import NavWrapper from '@/components/layout/NavWrapper'
import MapsProvider from '@/components/layout/MapsProvider'

export const metadata: Metadata = {
  title: 'Mimora',
  description: 'Pin your food memories to the map',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MapsProvider>
          {children}
          <NavWrapper />
        </MapsProvider>
      </body>
    </html>
  )
}
