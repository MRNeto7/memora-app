import type { Metadata, Viewport } from 'next'
import './globals.css'
import NavWrapper from '@/components/layout/NavWrapper'
import MapsProvider from '@/components/layout/MapsProvider'
import SafeAreaProvider from '@/components/layout/SafeAreaProvider'
import { Toaster } from '@/lib/toast'
import ScrollContainer from '@/components/layout/ScrollContainer'
import PersistentMapShell from '@/components/map/PersistentMapShell'

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
        <SafeAreaProvider />
        <Toaster />
        <MapsProvider>
          <PersistentMapShell />
          <ScrollContainer>{children}</ScrollContainer>
          <NavWrapper />
        </MapsProvider>
      </body>
    </html>
  )
}
