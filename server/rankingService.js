import { rankFivePack } from '../src/lib/elo.js'
import { generateCategory } from '../src/lib/categoryGenerator.js'
import { getAllState, upsertState } from './db.js'
import { loadMovies } from './movieStore.js'

// Merges the pool's static metadata with its persisted Elo state.
// Returns null if the enriched JSON doesn't exist yet.
export function getMoviesWithState(db, dataDir) {
  const staticMovies = loadMovies(dataDir)
  if (!staticMovies) return null
  const state = getAllState(db)
  return staticMovies.map((m) => ({
    ...m,
    eloRating: state.get(m.id)?.eloRating ?? 1000,
    timesRanked: state.get(m.id)?.timesRanked ?? 0,
  }))
}

// Applies a ranked 5-pack (movieIds in rank order) to the pool's Elo state.
// Throws if the pool or any movie id is unknown.
export function applyRank(db, dataDir, orderedMovieIds) {
  const movies = getMoviesWithState(db, dataDir)
  if (!movies) throw new Error('Movie pool not found')

  const movieMap = new Map(movies.map((m) => [m.id, m]))
  const pack = orderedMovieIds.map((id) => movieMap.get(id))
  if (pack.some((m) => !m)) throw new Error('Invalid movie id in rank request')

  const updatedRatings = rankFivePack(pack)
  for (const id of orderedMovieIds) {
    const timesRanked = movieMap.get(id).timesRanked + 1
    upsertState(db, id, updatedRatings[id], timesRanked)
  }

  return getMoviesWithState(db, dataDir)
}

// Generates a fresh category + 5-pack for the pool, respecting the overlap rule.
export function pickCategory(db, dataDir) {
  const movies = getMoviesWithState(db, dataDir)
  if (!movies) return null
  const rankedCount = movies.filter((m) => m.timesRanked > 0).length
  return generateCategory(movies, {
    isRanked: (m) => m.timesRanked > 0,
    totalRankedCount: rankedCount,
  })
}
