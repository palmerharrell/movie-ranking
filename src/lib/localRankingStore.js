import { rankPack } from './elo.js'

const STORAGE_KEY = 'movie-ranking:local-state'

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

// Merges the pool's static metadata with this browser's local Elo state,
// defaulting movies never ranked in this browser to 1000/0.
export function mergeWithLocalState(staticMovies) {
  const state = readAll()
  return staticMovies.map((m) => ({
    ...m,
    eloRating: state[m.id]?.eloRating ?? 1000,
    timesRanked: state[m.id]?.timesRanked ?? 0,
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
