// Ratings are out of 10. Users rate food, service, and ambiance (1-10 each,
// 0 = not rated); the overall is the average of the rated categories, kept
// on the 10-scale with one decimal (e.g. 7.3). Never round to whole numbers
// and never convert to a 5-scale — that's what corrupted early ratings.
export interface DetailRatings { food: number; service: number; ambiance: number }

export function calcOverall(r: DetailRatings): number {
  const vals = [r.food, r.service, r.ambiance].filter(v => v > 0)
  if (!vals.length) return 0
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}
