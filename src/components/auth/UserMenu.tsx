'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface UserMenuProps {
  email: string
}

export default function UserMenu({ email }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const initials = email.slice(0, 2).toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold"
        style={{ background: '#1e7a4c' }}
      >
        {initials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-11 z-20 bg-white rounded-2xl py-2 min-w-48"
            style={{ border: '1px solid #e8f0eb', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
          >
            <p className="px-4 py-2 text-xs" style={{ color: '#9eb3a4' }}>{email}</p>
            <div style={{ height: '0.5px', background: '#e8f0eb', margin: '4px 0' }} />
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50"
              style={{ color: 'var(--danger)' }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
