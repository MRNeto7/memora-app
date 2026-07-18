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
      <p className="text-xs font-semibold mb-3" style={{ color: 'var(--teal-600)' }}>{title}</p>
      {([['food', 'Food & drink'], ['service', 'Service'], ['ambiance', 'Ambiance']] as const).map(([key, label]) => (
        <div key={key} className="flex items-center gap-3 mb-2.5">
          <span className="text-xs w-20 flex-shrink-0" style={{ color: 'var(--slate)' }}>{label}</span>
          <div className="flex gap-1 flex-1">
            {Array.from({ length: 10 }, (_, i) => (
              <button key={i} type="button"
                onClick={() => onChange({ ...ratings, [key]: i + 1 === ratings[key] ? 0 : i + 1 })}
                className="flex-1 rounded-sm" style={{ height: 18, background: i < ratings[key] ? 'var(--gold-500)' : 'var(--stone-500)', opacity: i < ratings[key] ? 1 : 0.4 }} />
            ))}
          </div>
          <span className="text-xs w-5 text-right font-medium" style={{ color: ratings[key] > 0 ? 'var(--gold-500)' : 'var(--slate-light)' }}>{ratings[key] || '—'}</span>
        </div>
      ))}
      {overall > 0 && (
        <div className="flex items-center pt-2.5" style={{ borderTop: '0.5px solid rgba(16,20,22,0.1)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--teal-600)' }}>Overall</span>
          <span className="text-sm font-semibold ml-auto" style={{ color: 'var(--gold-500)' }}>{overall}/10</span>
        </div>
      )}
    </div>
  )
}
