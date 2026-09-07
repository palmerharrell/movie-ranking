import { subsetLabel } from './genreSubsets.js'

// Auto-generated snapshot name for a completed ranking (#227) — replaces the
// old user-typed name from the now-removed SaveRankingModal. Combines the
// active subset (plus the same PG-13 qualifier the modal's copy used to
// show) with today's date, so repeated runs of the same subset stay
// distinguishable in the Load Ranking list without requiring input.
export function generateRankingName(subset, pg13) {
  const label = pg13 ? `${subsetLabel(subset)} (PG-13 & Under)` : subsetLabel(subset)
  const date = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  return `${label} — ${date}`
}
