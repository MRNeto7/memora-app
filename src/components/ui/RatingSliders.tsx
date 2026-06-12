'use client'

import { calcOverall, DetailRatings } from '@/lib/ratings'

interface RatingSlidersProps {
  ratings: DetailRatings
  onChange: (ratings: DetailRatings) => void
  title?: string
}

// The one rating input for the whole app: three categories out of 10,
// tap the current value to clear it, overall average shown underneath.
export default function RatingSliders({ ratings, onChange, title = 'Rate your experience' }: RatingSlidersProps) {
  const overall = calcOverall(ratings)

  return (
    <div>
      <p className="text-xs font-semibold mb-3" style={{ color: '#0D4F57' }}>{title}</p>
      {([['food', 'Food & drink'], ['service', 'Service'], ['ambiance', 'Ambiance']] as const).map(([key, label]) => (
        <div key={key} className="flex items-center gap-3 mb-2.5">
          <span className="text-xs w-20 flex-shrink-0" style={{ color: '#7D878D' }}>{label}</span>
          <div className="flex gap-1 flex-1">
            {Array.from({ length: 10 }, (_, i) => (
              <button key={i} type="button"
                onClick={() => onChange({ ...ratings, [key]: i + 1 === ratings[key] ? 0 : i + 1 })}
                className="flex-1 rounded-sm" style={{ height: 18, background: i < ratings[key] ? '#C9A86A' : '#d4cdc3', opacity: i < ratings[key] ? 1 : 0.4 }} />
            ))}
          </div>
          <span className="text-xs w-5 text-right font-medium" style={{ color: ratings[key] > 0 ? '#C9A86A' : '#b0babe' }}>{ratings[key] || '—'}</span>
        </div>
      ))}
      {overall > 0 && (
        <div className="flex items-center pt-2.5" style={{ borderTop: '0.5px solid rgba(13,79,87,0.1)' }}>
          <span className="text-xs font-semibold" style={{ color: '#0D4F57' }}>Overall</span>
          <span className="text-sm font-semibold ml-auto" style={{ color: '#C9A86A' }}>{overall}/10</span>
        </div>
      )}
    </div>
  )
}
