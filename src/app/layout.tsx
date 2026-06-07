import type { Metadata, Viewport } from 'next'
import './globals.css'
import NavWrapper from '@/components/layout/NavWrapper'
import MapsProvider from '@/components/layout/MapsProvider'
import SafeAreaProvider from '@/components/layout/SafeAreaProvider'

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
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ height: '100%', overflow: 'hidden', position: 'fixed', width: '100%' }}>
        <SafeAreaProvider />
        <MapsProvider>
          {/* Full screen scroll container */}
          <div id="scroll-root" style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}>
            {children}
          </div>
          <NavWrapper />
        </MapsProvider>
      </body>
    </html>
  )
}
