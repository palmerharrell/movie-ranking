import { generateCategory } from './categoryGenerator.js'
import {
  mergeWithLocalState,
  applyRankToLocalState,
  resetLocalState,
  markSkipped as markSkippedLocal,
  unmarkSkipped as unmarkSkippedLocal,
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
function fetchStaticMovies({ family } = {}) {
  return request(family ? '/api/movies?family=true' : '/api/movies')
}

export async function getMovies({ family } = {}) {
  const staticMovies = await fetchStaticMovies({ family })
  return mergeWithLocalState(staticMovies)
}

// Skipped ("haven't seen") movies are excluded from the eligible pool
// entirely (#136), not just from the pack they were skipped in.
export async function getCategory({ family } = {}) {
  const movies = await getMovies({ family })
  const eligible = movies.filter((m) => !m.skipped)
  const rankedCount = eligible.filter((m) => m.timesRanked > 0).length
  return generateCategory(eligible, {
    isRanked: (m) => m.timesRanked > 0,
    totalRankedCount: rankedCount,
  })
}

export function markSkipped(movieId) {
  markSkippedLocal(movieId)
}

export function unmarkSkipped(movieId) {
  unmarkSkippedLocal(movieId)
}

// Unfiltered — a pack built in Family mode still only contains family-safe
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

export async function saveRanking(name, { family } = {}) {
  const movies = await getMovies({ family })
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
    body: JSON.stringify({ name, family: !!family, entries, clientId: getOrCreateClientId() }),
  })
  resetLocalState(eligible.map((m) => m.id))
  return result
}

export async function resetRanking({ family } = {}) {
  const movies = await getMovies({ family })
  resetLocalState(movies.map((m) => m.id))
}

export function getSavedRankings() {
  return request('/api/rankings')
}

export function getSavedRanking(id) {
  return request(`/api/rankings/${id}`)
}
