import { rankPack } from './elo.js'

const STORAGE_KEY = 'movie-ranking:local-state'
// Separate from STORAGE_KEY: "haven't seen" is a fact about the viewer, not
// about a ranking run, so it survives a reset/save that clears eloRating/
// timesRanked back to defaults (#136).
const SKIPPED_STORAGE_KEY = 'movie-ranking:skipped-ids'

// In-progress ranking state (eloRating/timesRanked) lives in this browser's
// localStorage rather than on the server (#115), so concurrent visitors
// can't interfere with each other's ranking runs. Family mode filters which
// movies are visible/eligible, but there is only one shared state map here —
// a movie's rating is the same regardless of which theme was active when it
// was ranked.
function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeAll(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function readSkippedIds() {
  try {
    const raw = localStorage.getItem(SKIPPED_STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function writeSkippedIds(ids) {
  localStorage.setItem(SKIPPED_STORAGE_KEY, JSON.stringify([...ids]))
}

// Marks a movie "haven't seen" (#136) — permanently excluded from future
// pack generation and from the ranked-progress denominator, until un-skipped.
// Also clears any existing eloRating/timesRanked for it (#169): a movie
// ranked and later skipped shouldn't keep stale rating data lingering in the
// Standings — skipping it removes it from the ranking, not just from future
// packs. Un-skipping afterward correctly starts it back at defaults rather
// than restoring the old rating, since that data is now gone.
export function markSkipped(movieId) {
  const ids = readSkippedIds()
  ids.add(movieId)
  writeSkippedIds(ids)
  resetLocalState([movieId])
}

// Reverses markSkipped — used by the in-pack "undo skip" action, while the
// pack that skip happened in is still active.
export function unmarkSkipped(movieId) {
  const ids = readSkippedIds()
  ids.delete(movieId)
  writeSkippedIds(ids)
}

// Batched form of unmarkSkipped — one read/write instead of one pair per id.
// Used by the Skipped view's "Clear all" (#137).
export function unmarkAllSkipped(movieIds) {
  const ids = readSkippedIds()
  for (const movieId of movieIds) ids.delete(movieId)
  writeSkippedIds(ids)
}

// Merges the pool's static metadata with this browser's local Elo state and
// skipped-ids set, defaulting movies never ranked in this browser to 1000/0
// and never skipped to false.
export function mergeWithLocalState(staticMovies) {
  const state = readAll()
  const skippedIds = readSkippedIds()
  return staticMovies.map((m) => ({
    ...m,
    eloRating: state[m.id]?.eloRating ?? 1000,
    timesRanked: state[m.id]?.timesRanked ?? 0,
    skipped: skippedIds.has(m.id),
  }))
}

// Applies a ranked pack (2-5 movies, each { id, eloRating, timesRanked }, in
// rank order) to this browser's local Elo state.
export function applyRankToLocalState(orderedMovies) {
  const state = readAll()
  const updatedRatings = rankPack(orderedMovies)
  for (const m of orderedMovies) {
    state[m.id] = { eloRating: updatedRatings[m.id], timesRanked: m.timesRanked + 1 }
  }
  writeAll(state)
}

// Clears local Elo state for `movieIds` back to defaults (1000/0).
export function resetLocalState(movieIds) {
  const state = readAll()
  for (const id of movieIds) delete state[id]
  writeAll(state)
}
