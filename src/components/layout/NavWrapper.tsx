'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'

export default function NavWrapper() {
  const pathname = usePathname()
  const isAuthPage = pathname.startsWith('/auth')
  if (isAuthPage) return null
  return <BottomNav />
}
