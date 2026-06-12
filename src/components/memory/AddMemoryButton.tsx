'use client'

interface AddMemoryButtonProps {
  onClick: () => void
}

export default function AddMemoryButton({ onClick }: AddMemoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className="rise press absolute right-5 z-10 flex items-center gap-2 px-5 py-3 rounded-full text-white font-semibold text-sm"
      style={{
        background: 'rgba(13,79,87,0.88)',
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        border: '0.5px solid rgba(255,255,255,0.25)',
        boxShadow: '0 8px 28px rgba(13,79,87,0.4)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 102px)',
      }}
    >
      <span style={{ color: '#C9A86A', fontSize: 18, lineHeight: 1 }}>+</span>
      Save memory
    </button>
  )
}
