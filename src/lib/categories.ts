// Venue + meal categories. Ratings only mean something in context —
// an 8 at a street-food stall is not an 8 at a Michelin star.

export type VenueType = 'fast_food' | 'cafe' | 'restaurant' | 'high_end' | 'street_food' | 'pub'
export type MealType = 'breakfast' | 'lunch' | 'dinner'

export const VENUE_TYPES: { value: VenueType; label: string; emoji: string }[] = [
  { value: 'restaurant',  label: 'Restaurant',  emoji: '🍽️' },
  { value: 'cafe',        label: 'Café',        emoji: '☕' },
  { value: 'pub',         label: 'Pub / bar',   emoji: '🍺' },
  { value: 'high_end',    label: 'High end',    emoji: '✨' },
  { value: 'street_food', label: 'Street food', emoji: '🌮' },
  { value: 'fast_food',   label: 'Fast food',   emoji: '🍔' },
]

export const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { value: 'lunch',     label: 'Lunch',     emoji: '☀️' },
  { value: 'dinner',    label: 'Dinner',    emoji: '🌙' },
]

export function venueTypeLabel(v: string | null | undefined) {
  return VENUE_TYPES.find(t => t.value === v)
}
export function mealTypeLabel(m: string | null | undefined) {
  return MEAL_TYPES.find(t => t.value === m)
}

/** Suggest a venue type from Google Places `types` — user can always override. */
export function venueTypeFromGoogle(types: string[] | undefined): VenueType | null {
  if (!types?.length) return null
  const t = new Set(types)
  if (t.has('cafe') || t.has('bakery') || t.has('coffee_shop')) return 'cafe'
  if (t.has('bar') || t.has('pub') || t.has('night_club')) return 'pub'
  if (t.has('meal_takeaway') || t.has('fast_food_restaurant')) return 'fast_food'
  if (t.has('restaurant') || t.has('meal_delivery') || t.has('food')) return 'restaurant'
  return null
}

/** Suggest breakfast/lunch/dinner from the photo's timestamp. */
export function mealTypeFromDate(d: Date | null | undefined): MealType | null {
  if (!d) return null
  const h = d.getHours() + d.getMinutes() / 60
  if (h < 11.5) return 'breakfast'
  if (h < 16.5) return 'lunch'
  return 'dinner'
}
