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
                background: active ? '#0D4F57' : '#fafaf9',
                color: active ? '#EAE5DD' : '#7D878D',
                border: `1px solid ${active ? '#0D4F57' : '#EAE5DD'}`,
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
                background: active ? '#C9A86A' : '#fafaf9',
                color: active ? '#fff' : '#7D878D',
                border: `1px solid ${active ? '#C9A86A' : '#EAE5DD'}`,
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
