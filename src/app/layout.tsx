import type { Metadata } from 'next'
import './globals.css'
import BottomNav from '@/components/layout/BottomNav'

export const metadata: Metadata = {
  title: 'Memora',
  description: 'Pin your food memories to the map',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ paddingBottom: 80 }}>
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
