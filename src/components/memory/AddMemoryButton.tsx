'use client'

interface AddMemoryButtonProps {
  onClick: () => void
}

export default function AddMemoryButton({ onClick }: AddMemoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute right-5 z-10 flex items-center gap-2 px-5 py-3 rounded-full text-white font-semibold text-sm transition-transform active:scale-95"
      style={{
        background: '#0D4F57',
        boxShadow: '0 4px 20px rgba(13,79,87,0.35)',
        bottom: 'calc(env(safe-area-inset-bottom) + 96px)',
      }}
    >
      <span style={{ color: '#C9A86A', fontSize: 18, lineHeight: 1 }}>+</span>
      Save memory
    </button>
  )
}
