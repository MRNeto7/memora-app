'use client'

import { VENUE_TYPES, MEAL_TYPES, VenueType, MealType } from '@/lib/categories'

interface CategoryPickerProps {
  venueType: VenueType | null
  mealType: MealType | null
  onVenueType: (v: VenueType | null) => void
  onMealType: (m: MealType | null) => void
  compact?: boolean
}

// Two chip rows — tap to select, tap again to clear. Both optional.
export default function CategoryPicker({ venueType, mealType, onVenueType, onMealType, compact }: CategoryPickerProps) {
  const chipPad = compact ? '5px 10px' : '7px 12px'
  const fontSize = compact ? 11 : 12

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {VENUE_TYPES.map(t => {
          const active = venueType === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onVenueType(active ? null : t.value)}
              className="flex-shrink-0 rounded-full font-medium transition-all"
              style={{
                padding: chipPad, fontSize,
                background: active ? 'var(--teal-600)' : 'var(--stone-100)',
                color: active ? 'var(--stone-400)' : 'var(--slate)',
                border: `1px solid ${active ? 'var(--teal-600)' : 'var(--stone-400)'}`,
              }}
            >
              {t.emoji} {t.label}
            </button>
          )
        })}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {MEAL_TYPES.map(t => {
          const active = mealType === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onMealType(active ? null : t.value)}
              className="flex-shrink-0 rounded-full font-medium transition-all"
              style={{
                padding: chipPad, fontSize,
                background: active ? 'var(--gold-500)' : 'var(--stone-100)',
                color: active ? '#fff' : 'var(--slate)',
                border: `1px solid ${active ? 'var(--gold-500)' : 'var(--stone-400)'}`,
              }}
            >
              {t.emoji} {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
