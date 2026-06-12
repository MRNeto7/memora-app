'use client'

import { useEffect, useState } from 'react'
import { MemoryWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'

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
      const { data } = await supabase.storage
        .from('memory-photos')
        .createSignedUrl(firstPhoto.storage_path, 3600)
      if (data?.signedUrl) setPhotoUrl(data.signedUrl)
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
          border: `3px solid ${isSelected ? '#1e7a4c' : '#fff'}`,
          boxShadow: isSelected
            ? '0 4px 16px rgba(30,122,76,0.45)'
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
              background: '#1e7a4c',
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
      <div style={{ width: 2, height: 6, background: isSelected ? '#1e7a4c' : '#bbb', borderRadius: 1 }} />
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#1e7a4c' : '#bbb' }} />
    </div>
  )
}
