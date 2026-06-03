'use client'

import { MemoryWithDetails } from '@/lib/types/database'

interface MemoryPinProps {
  memory: MemoryWithDetails
  isSelected: boolean
}

export default function MemoryPin({ memory, isSelected }: MemoryPinProps) {
  const hasPhoto = memory.memory_photos.length > 0

  return (
    <div className="flex flex-col items-center cursor-pointer">
      <div
        className="transition-all duration-200"
        style={{
          width: isSelected ? 48 : 40,
          height: isSelected ? 48 : 40,
          borderRadius: '50%',
          border: `3px solid ${isSelected ? '#1e7a4c' : '#fff'}`,
          boxShadow: isSelected
            ? '0 4px 16px rgba(30,122,76,0.4)'
            : '0 2px 8px rgba(0,0,0,0.2)',
          background: '#f0faf4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {hasPhoto ? (
          // Photo thumbnail — we'll use a placeholder emoji for now
          // Real implementation: signed URL from Supabase Storage
          <span style={{ fontSize: isSelected ? 22 : 18 }}>🍽️</span>
        ) : (
          <span style={{ fontSize: isSelected ? 22 : 18 }}>📍</span>
        )}
      </div>
      {/* Pin tail */}
      <div
        style={{
          width: 2,
          height: 6,
          background: isSelected ? '#1e7a4c' : '#ccc',
          borderRadius: 1,
        }}
      />
      <div
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: isSelected ? '#1e7a4c' : '#ccc',
        }}
      />
    </div>
  )
}
