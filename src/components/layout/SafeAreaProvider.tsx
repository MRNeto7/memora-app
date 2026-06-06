'use client'

import { useEffect } from 'react'

export default function SafeAreaProvider() {
  useEffect(() => {
    function updateSafeAreas() {
      // Read actual safe area values and set as CSS variables
      const style = getComputedStyle(document.documentElement)
      
      // Try env() values first
      const top = style.getPropertyValue('--sat').trim() || '0px'
      const bottom = style.getPropertyValue('--sab').trim() || '0px'
      
      // Also set via direct measurement for Capacitor
      const testEl = document.createElement('div')
      testEl.style.cssText = `
        position: fixed;
        top: env(safe-area-inset-top, 0px);
        left: env(safe-area-inset-left, 0px);
        right: env(safe-area-inset-right, 0px);
        bottom: env(safe-area-inset-bottom, 0px);
        pointer-events: none;
        visibility: hidden;
        width: 1px;
        height: 1px;
      `
      document.body.appendChild(testEl)
      const rect = testEl.getBoundingClientRect()
      document.body.removeChild(testEl)

      const safeTop = rect.top
      const safeBottom = window.innerHeight - rect.bottom
      const safeLeft = rect.left
      const safeRight = window.innerWidth - (rect.left + rect.width) // approximate

      document.documentElement.style.setProperty('--safe-top', `${Math.max(safeTop, 0)}px`)
      document.documentElement.style.setProperty('--safe-bottom', `${Math.max(safeBottom, 0)}px`)
      document.documentElement.style.setProperty('--safe-left', `${Math.max(safeLeft, 0)}px`)
      document.documentElement.style.setProperty('--safe-right', `${Math.max(safeRight, 0)}px`)
    }

    updateSafeAreas()
    window.addEventListener('resize', updateSafeAreas)
    // Run again after a short delay for Capacitor
    setTimeout(updateSafeAreas, 100)
    setTimeout(updateSafeAreas, 500)

    return () => window.removeEventListener('resize', updateSafeAreas)
  }, [])

  return null
}
