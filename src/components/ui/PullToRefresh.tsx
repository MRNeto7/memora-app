'use client'

import { useState, useRef, useCallback } from 'react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const THRESHOLD = 70

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current
    if (!container) return
    // Only trigger if scrolled to top
    if (container.scrollTop > 2) return
    startY.current = e.touches[0].clientY
    setPulling(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling) return
    const container = containerRef.current
    if (!container || container.scrollTop > 2) return
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0) {
      setPullDistance(Math.min(dy * 0.5, THRESHOLD + 20))
    }
  }, [pulling])

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return
    setPulling(false)
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true)
      setPullDistance(THRESHOLD)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [pulling, pullDistance, onRefresh])

  const progress = Math.min(pullDistance / THRESHOLD, 1)
  const showIndicator = pullDistance > 10

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch' as never,
        position: 'relative',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {showIndicator && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          height: pullDistance,
          alignItems: 'flex-end',
          paddingBottom: 8,
          transition: refreshing ? 'none' : 'height 0.1s',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#0D4F57',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${0.5 + progress * 0.5})`,
            opacity: progress,
            transition: refreshing ? 'none' : 'transform 0.1s',
          }}>
            {refreshing ? (
              <div style={{
                width: 16,
                height: 16,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#C9A86A',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A86A" strokeWidth="2.5"
                style={{ transform: `rotate(${progress * 180}deg)` }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      {children}
    </div>
  )
}
