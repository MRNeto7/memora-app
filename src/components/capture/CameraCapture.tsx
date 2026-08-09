'use client'

import Portal from '@/components/ui/Portal'
import Icon from '@/components/ui/Icon'

// Camera-first capture screen. A live in-page viewfinder (getUserMedia) is
// blocked by iOS for a remote-loaded WebView, so the shutter opens the real
// iOS camera via a file input with capture="environment" (reliable, and uses
// the app's camera permission). A library option sits below.
export default function CameraCapture({ onFiles, onClose }: {
  onFiles: (files: FileList | File[] | null) => void
  onClose: () => void
}) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-6" style={{ background: 'var(--stone-400)' }}>
        {/* Close */}
        <button onClick={onClose} aria-label="Close"
          className="absolute w-10 h-10 rounded-full flex items-center justify-center"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: 20, background: 'var(--stone-200)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16191B" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>

        <p className="text-sm mb-12" style={{ color: 'var(--slate)' }}>Capture a food memory</p>

        {/* Shutter — opens the native camera */}
        <label className="cursor-pointer active:scale-95 transition-transform flex items-center justify-center rounded-full"
          style={{ width: 88, height: 88, background: 'var(--stone-200)', border: '4px solid var(--teal-600)' }}>
          <Icon name="camera" size={34} color="var(--teal-600)" />
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onFiles(e.target.files)} />
        </label>
        <p className="text-xs mt-3 font-semibold" style={{ color: 'var(--teal-600)' }}>Tap to open camera</p>

      </div>
    </Portal>
  )
}
