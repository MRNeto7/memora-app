'use client'

import { useEffect, useState } from 'react'
import { MemoryWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { getSignedPhotoUrl } from '@/lib/storage'

interface MemoryPinProps {
  memory: MemoryWithDetails
  isSelected: boolean
}

export default function MemoryPin({ memory, isSelected }: MemoryPinProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const supabase = createClient()

  const firstPhoto = memory.memory_photos?.[0]

  useEffect(() => {
    if (!firstPhoto) return
    async function loadPhoto() {
      const url = await getSignedPhotoUrl(supabase, firstPhoto!.storage_path)
      if (url) setPhotoUrl(url)
    }
    loadPhoto()
  }, [firstPhoto?.storage_path])

  const size = isSelected ? 52 : 44

  return (
    <div className="flex flex-col items-center" style={{ cursor: 'pointer' }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: `3px solid ${isSelected ? 'var(--teal-600)' : '#fff'}`,
          boxShadow: isSelected
            ? '0 4px 16px rgba(16,20,22,0.45)'
            : '0 2px 8px rgba(0,0,0,0.25)',
          background: '#f0faf4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Memory"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--teal-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}>
              {memory.venue?.name?.slice(0, 2).toUpperCase() ?? 'M'}
            </span>
          </div>
        )}
      </div>
      {/* Pin tail */}
      <div style={{ width: 2, height: 6, background: isSelected ? 'var(--teal-600)' : '#bbb', borderRadius: 1 }} />
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? 'var(--teal-600)' : '#bbb' }} />
      {/* Venue name label */}
      {memory.venue?.name && (
        <div style={{
          marginTop: 2,
          background: isSelected ? 'var(--teal-600)' : 'rgba(255,255,255,0.95)',
          borderRadius: 6,
          padding: '2px 6px',
          fontSize: 10,
          fontWeight: 600,
          color: isSelected ? '#fff' : 'var(--teal-600)',
          maxWidth: 90,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s ease',
        }}>
          {memory.venue.name}
        </div>
      )}
    </div>
  )
}
