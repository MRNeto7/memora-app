'use client'

interface AddMemoryButtonProps {
  onClick: () => void
}

export default function AddMemoryButton({ onClick }: AddMemoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-8 right-6 z-10 flex items-center gap-2 px-5 py-3 rounded-full text-white font-semibold text-sm shadow-lg transition-transform active:scale-95"
      style={{ background: '#1e7a4c', boxShadow: '0 4px 20px rgba(30,122,76,0.35)' }}
    >
      <span style={{ fontSize: 18 }}>+</span>
      Save memory
    </button>
  )
}
