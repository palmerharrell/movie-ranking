import { generateCategory } from './categoryGenerator.js'
import { genreSubsetExclusions } from './genreSubsets.js'
import { familySubsetExclusions } from './familyMode.js'
import {
  mergeWithLocalState,
  applyRankToLocalState,
  resetLocalState,
  markSkipped as markSkippedLocal,
  unmarkSkipped as unmarkSkippedLocal,
  unmarkAllSkipped as unmarkAllSkippedLocal,
  restoreSkipped as restoreSkippedLocal,
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
// whatever subset the rest of the app is currently showing.
export async function getSkippedMovies() {
  const movies = await getMovies()
  return movies.filter((m) => m.skipped)
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
  const result = await request('/api/rankings', {
    method: 'POST',
    body: JSON.stringify({
      name,
      subset: subset || null,
      pg13: !!pg13,
      entries,
      clientId: getOrCreateClientId(),
    }),
  })
  resetLocalState(eligible.map((m) => m.id))
  return result
}

export async function resetRanking({ family, popular, genre, pg13 } = {}) {
  const movies = await getMovies({ family, popular, genre, pg13 })
  resetLocalState(movies.map((m) => m.id))
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
