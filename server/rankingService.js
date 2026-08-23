import { rankFivePack } from '../src/lib/elo.js'
import { generateCategory } from '../src/lib/categoryGenerator.js'
import { getAllState, upsertState } from './db.js'
import { loadListMovies } from './movieStore.js'

// Merges a list's static metadata with its persisted Elo state.
// Returns null if the list's enriched JSON doesn't exist yet.
export function getMoviesWithState(db, dataDir, listId) {
  const staticMovies = loadListMovies(dataDir, listId)
  if (!staticMovies) return null
  const state = getAllState(db, listId)
  return staticMovies.map((m) => ({
    ...m,
    eloRating: state.get(m.id)?.eloRating ?? 1000,
    timesRanked: state.get(m.id)?.timesRanked ?? 0,
  }))
}

// Applies a ranked 5-pack (movieIds in rank order) to a list's Elo state.
// Throws if the list or any movie id is unknown.
export function applyRank(db, dataDir, listId, orderedMovieIds) {
  const movies = getMoviesWithState(db, dataDir, listId)
  if (!movies) throw new Error(`Unknown list: ${listId}`)

  const movieMap = new Map(movies.map((m) => [m.id, m]))
  const pack = orderedMovieIds.map((id) => movieMap.get(id))
  if (pack.some((m) => !m)) throw new Error('Invalid movie id in rank request')

  const updatedRatings = rankFivePack(pack)
  for (const id of orderedMovieIds) {
    const timesRanked = movieMap.get(id).timesRanked + 1
    upsertState(db, listId, id, updatedRatings[id], timesRanked)
  }

  return getMoviesWithState(db, dataDir, listId)
}

// Generates a fresh category + 5-pack for a list, respecting the overlap rule.
export function pickCategoryForList(db, dataDir, listId) {
  const movies = getMoviesWithState(db, dataDir, listId)
  if (!movies) return null
  const rankedCount = movies.filter((m) => m.timesRanked > 0).length
  return generateCategory(movies, {
    isRanked: (m) => m.timesRanked > 0,
    totalRankedCount: rankedCount,
  })
}
