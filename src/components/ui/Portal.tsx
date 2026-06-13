'use client'

import { createPortal } from 'react-dom'

// Renders children at the document body so overlays escape any ancestor
// stacking context (the page-enter animation and the fixed map shell both
// create one, which would otherwise trap sheets beneath the bottom nav).
// SSR-safe: returns null on the server. Sheets only mount after client
// interaction, so there's no hydration mismatch.
export default function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
