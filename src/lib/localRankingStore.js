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
// Rankings — skipping it removes it from the ranking, not just from future
// packs. Un-skipping afterward correctly starts it back at defaults rather
// than restoring the old rating, since that data is now gone.
export function markSkipped(movieId) {
  const ids = readSkippedIds()
  ids.add(movieId)
  writeSkippedIds(ids)
  resetLocalState([movieId])
}

// Reverses markSkipped's skipped-flag half only — used by the persistent
// Skipped view's per-movie "Un-skip", which intentionally leaves rating data
// at the defaults markSkipped reset it to (see markSkipped comment above).
export function unmarkSkipped(movieId) {
  const ids = readSkippedIds()
  ids.delete(movieId)
  writeSkippedIds(ids)
}

// Full reversal of markSkipped — used by the in-pack "undo skip" action
// while the pack that skip happened in is still active, so undoing a skip
// restores the exact rating markSkipped just wiped, rather than leaving the
// movie stuck at defaults like the persistent un-skip above (#169).
export function restoreSkipped(movieId, eloRating, timesRanked) {
  unmarkSkipped(movieId)
  const state = readAll()
  state[movieId] = { eloRating, timesRanked }
  writeAll(state)
}

// Batched form of unmarkSkipped — one read/write instead of one pair per id.
// Used by the Skipped view's "Clear all" (#137).
export function unmarkAllSkipped(movieIds) {
  const ids = readSkippedIds()
  for (const movieId of movieIds) ids.delete(movieId)
  writeSkippedIds(ids)
}

// Skipped-movie ids in most-recently-skipped-first order (#374), for the
// Skipped view's own list — `writeSkippedIds` serializes the Set in
// insertion order (a plain JS Set iterates in insertion order, and
// `markSkipped`/`unmarkSkipped`+re-add always append via `.add`), so the
// stored array is already oldest-to-newest; this just reverses it rather
// than tracking a separate timestamp per movie.
export function getSkippedIdsMostRecentFirst() {
  return [...readSkippedIds()].reverse()
}

// The true count of persistently-skipped movies across the whole pool,
// regardless of which subset is active (#337) — a direct, synchronous read
// of the same skipped-ids set the Skipped view's own list
// (api.getSkippedMovies) is filtered from, so the footer's Skipped-tab count
// always matches what that drawer actually lists. Deliberately not derived
// from App.jsx's subset-filtered `movies` state, which only reflects skips
// within the currently-active subset.
export function getSkippedCount() {
  return readSkippedIds().size
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

// "Refine Ranking" support: resets timesRanked back to 0 for `movieIds`
// while keeping their existing eloRating, so a fresh pass refines from
// current standings instead of starting over at the 1000 default. A movie
// with no existing entry (shouldn't normally happen — these are only called
// for already-fully-ranked movies) is left untouched rather than seeded
// with a fabricated rating.
export function resetTimesRankedOnly(movieIds) {
  const state = readAll()
  for (const id of movieIds) {
    if (state[id]) state[id] = { ...state[id], timesRanked: 0 }
  }
  writeAll(state)
}

// "Continue" a saved ranking from the Start screen (#361): imports a saved
// snapshot's own eloRating for each entry, overwriting whatever's currently
// in this browser's local state for those movies (which may have drifted
// since the snapshot was saved, e.g. a Reset or a further Refine pass), and
// resets timesRanked to 0 — same "keep the rating, re-rank fresh" idea as
// resetTimesRankedOnly above, just importing the rating from the snapshot
// rather than reading whatever's already stored locally.
export function loadSnapshotForContinue(entries) {
  const state = readAll()
  for (const { movieId, eloRating } of entries) {
    state[movieId] = { eloRating, timesRanked: 0 }
  }
  writeAll(state)
}
