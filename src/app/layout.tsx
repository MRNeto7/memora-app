import type { Metadata } from 'next'
import './globals.css'
import NavWrapper from '@/components/layout/NavWrapper'

export const metadata: Metadata = {
  title: 'Memora',
  description: 'Pin your food memories to the map',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <NavWrapper />
      </body>
    </html>
  )
}
