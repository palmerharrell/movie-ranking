import { generateCategory, generateTurn } from './categoryGenerator.js'
import { genreSubsetExclusions } from './genreSubsets.js'
import { familySubsetExclusions } from './familyMode.js'
import {
  mergeWithLocalState,
  applyRankToLocalState,
  resetLocalState,
  resetTimesRankedOnly,
  markSkipped as markSkippedLocal,
  unmarkSkipped as unmarkSkippedLocal,
  unmarkAllSkipped as unmarkAllSkippedLocal,
  restoreSkipped as restoreSkippedLocal,
  getSkippedCount as getSkippedCountLocal,
  getSkippedIdsMostRecentFirst,
  loadSnapshotForContinue,
} from './localRankingStore.js'
import { getOrCreateClientId } from './clientId.js'

const BASE_URL = import.meta.env.VITE_API_URL
const API_TOKEN = import.meta.env.VITE_API_TOKEN

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error = new Error(body.error || `Request failed (${res.status})`)
    error.status = res.status
    throw error
  }
  return res.json()
}

// The pool's static metadata only — no per-visitor eloRating/timesRanked.
// That state lives in this browser's localStorage (#115), not the server.
function fetchStaticMovies({ family, popular, genre, pg13 } = {}) {
  const params = new URLSearchParams()
  if (family) params.set('family', 'true')
  if (popular) params.set('popular', 'true')
  if (genre) params.set('genre', genre)
  if (pg13) params.set('pg13', 'true')
  const qs = params.toString()
  return request(qs ? `/api/movies?${qs}` : '/api/movies')
}

export async function getMovies({ family, popular, genre, pg13 } = {}) {
  const staticMovies = await fetchStaticMovies({ family, popular, genre, pg13 })
  return mergeWithLocalState(staticMovies)
}

// Skipped ("haven't seen") movies are excluded from the eligible pool
// entirely (#136), not just from the pack they were skipped in. When `genre`
// names an active genre/language subset, or `family` is active, its own
// defining attribute(s) are excluded from category generation (#160) —
// every movie in this pool already matches it, so a category built on it
// would be tautological (e.g. no "Family Movies" category while the Family
// subset, itself Family-genre-filtered per #152, is active).
export async function getCategory({ family, popular, genre, pg13 } = {}) {
  const movies = await getMovies({ family, popular, genre, pg13 })
  const eligible = movies.filter((m) => !m.skipped)
  const rankedCount = eligible.filter((m) => m.timesRanked > 0).length
  return generateCategory(eligible, {
    isRanked: (m) => m.timesRanked > 0,
    totalRankedCount: rankedCount,
    excludedAttributes: [
      ...(family ? familySubsetExclusions() : []),
      ...(genre ? genreSubsetExclusions(genre) : []),
    ],
  })
}

// The next turn (#297) — either a single forced pack (same shape/behavior as
// getCategory above) or a 3-way choice of candidate packs. Fetches movies
// once and derives everything from that one snapshot, rather than the old
// "Up Next" queue's pattern of one network round trip per queue slot.
export async function getNextTurn({ family, popular, genre, pg13 } = {}) {
  const movies = await getMovies({ family, popular, genre, pg13 })
  const eligible = movies.filter((m) => !m.skipped)
  const rankedCount = eligible.filter((m) => m.timesRanked > 0).length
  return generateTurn(eligible, {
    isRanked: (m) => m.timesRanked > 0,
    totalRankedCount: rankedCount,
    excludedAttributes: [
      ...(family ? familySubsetExclusions() : []),
      ...(genre ? genreSubsetExclusions(genre) : []),
    ],
  })
}

export function markSkipped(movieId) {
  markSkippedLocal(movieId)
}

export function unmarkSkipped(movieId) {
  unmarkSkippedLocal(movieId)
}

// Full reversal of markSkipped — used by the in-pack "undo skip" action,
// which restores the exact eloRating/timesRanked markSkipped just wiped
// (#169), unlike the persistent Skipped-view unmarkSkipped above.
export function restoreSkipped(movieId, eloRating, timesRanked) {
  restoreSkippedLocal(movieId, eloRating, timesRanked)
}

// Every persistently-skipped movie across the whole pool, regardless of
// which subset is currently active — skip state isn't scoped to a subset
// (#136), so the Skipped view (#137) needs the unfiltered pool rather than
// whatever subset the rest of the app is currently showing. Ordered
// most-recently-skipped-first (#374) rather than `movies`' own alphabetical/
// eloRating order.
export async function getSkippedMovies() {
  const movies = await getMovies()
  const byId = new Map(movies.filter((m) => m.skipped).map((m) => [m.id, m]))
  return getSkippedIdsMostRecentFirst()
    .map((id) => byId.get(id))
    .filter(Boolean)
}

// The true count of skipped movies across the whole pool (#337) — same
// underlying skipped-ids set getSkippedMovies above filters from, but a
// synchronous local read with no fetch, so the footer's Skipped-tab count
// can match the drawer's own list without an extra network round trip.
export function getSkippedCount() {
  return getSkippedCountLocal()
}

// Un-skips every given movie in one batched write (#137's "Clear all").
export function unmarkAllSkipped(movieIds) {
  unmarkAllSkippedLocal(movieIds)
}

// Unfiltered — a pack built in Family mode still only contains Family-genre
// movies, but the returned pool reflects every movie's state (mirrors the
// pre-#115 server response, which was always unfiltered).
export async function rankPack(movieIds) {
  const staticMovies = await fetchStaticMovies()
  const merged = mergeWithLocalState(staticMovies)
  const movieMap = new Map(merged.map((m) => [m.id, m]))
  const pack = movieIds.map((id) => movieMap.get(id))
  if (pack.some((m) => !m)) throw new Error('Invalid movie id in rank request')
  applyRankToLocalState(pack)
  return mergeWithLocalState(staticMovies)
}

// `subset` is the picker's own subset id ('popular', 'family', 'all', or a
// genre/language/country id) — stamped on the snapshot so the Load dialog
// can later filter to just the active subset (see getSavedRankings). `pg13`
// is stamped separately (#193) — it's an independent, composable dimension
// from `subset` rather than one of the subset ids.
export async function saveRanking(name, { family, popular, genre, pg13, subset } = {}) {
  const movies = await getMovies({ family, popular, genre, pg13 })
  const eligible = movies.filter((m) => !m.skipped)
  if (eligible.length === 0 || eligible.some((m) => m.timesRanked < 1)) {
    throw new Error('Every movie in the pool must be ranked at least once before saving')
  }
  const entries = eligible.map((m) => ({
    movieId: m.id,
    eloRating: m.eloRating,
    timesRanked: m.timesRanked,
  }))
  // Saving no longer resets local ranking state — Save is a non-destructive
  // "create a named snapshot" action; only Refine (timesRanked-only) and
  // Start Over (full reset) below change local progress.
  return request('/api/rankings', {
    method: 'POST',
    body: JSON.stringify({
      name,
      subset: subset || null,
      pg13: !!pg13,
      entries,
      clientId: getOrCreateClientId(),
    }),
  })
}

export async function resetRanking({ family, popular, genre, pg13 } = {}) {
  const movies = await getMovies({ family, popular, genre, pg13 })
  resetLocalState(movies.map((m) => m.id))
}

// "Refine Ranking" — resets timesRanked (not eloRating) for every
// non-skipped movie in scope, so a fresh full pass refines from current
// standings instead of starting over from the 1000 default.
export async function refineRanking({ family, popular, genre, pg13 } = {}) {
  const movies = await getMovies({ family, popular, genre, pg13 })
  const eligible = movies.filter((m) => !m.skipped)
  resetTimesRankedOnly(eligible.map((m) => m.id))
}

// Restricted to snapshots saved from the given subset id (#186 follow-up)
// and, when `pg13` is a boolean, to snapshots saved with the
// PG-13-and-under toggle in that same state (#193) — the Load dialog only
// ever wants saves matching the currently active subset+toggle combination.
export function getSavedRankings(subset, pg13) {
  const params = new URLSearchParams()
  if (subset) params.set('subset', subset)
  if (pg13 === true || pg13 === false) params.set('pg13', String(pg13))
  const qs = params.toString()
  return request(qs ? `/api/rankings?${qs}` : '/api/rankings')
}

export function getSavedRanking(id) {
  return request(`/api/rankings/${id}`)
}

// "Continue" a saved ranking from the Start screen (#361) — imports the
// snapshot's own eloRating for each of its movies into this browser's local
// state (see loadSnapshotForContinue) and resets timesRanked to 0, so the
// caller can then switch to the snapshot's own subset/pg13 and fetch a fresh
// turn, same as Refine Ranking's own flow but starting from the snapshot's
// ratings instead of whatever's currently active locally.
export async function continueSavedRanking(id) {
  const saved = await getSavedRanking(id)
  loadSnapshotForContinue(saved.movies.map((m) => ({ movieId: m.id, eloRating: m.eloRating })))
}

// Lazily backfills a share slug (#220) for a saved ranking that predates
// sharing — new saves already get one back from `saveRanking` itself, so
// this is only needed for a legacy row (LoadRankingView calls it when the
// snapshot it loaded has no `shareSlug`).
export function shareRanking(id) {
  return request(`/api/rankings/${id}/share`, { method: 'POST' })
}

// Public — no auth header needed server-side (the route is registered
// before the bearer-token middleware), since anyone with the link should be
// able to view it. Returns { name, subset, pg13, movies } where `movies` is
// just the Top 10, public fields only (see getSharedRankingTopTen).
export function getSharedRanking(slug) {
  return request(`/api/rankings/share/${slug}`)
}
