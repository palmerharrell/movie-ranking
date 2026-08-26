import { rankPack } from '../src/lib/elo.js'
import { generateCategory } from '../src/lib/categoryGenerator.js'
import {
  getAllState,
  upsertState,
  resetAllState,
  createSavedRanking,
  listSavedRankings as listSavedRankingsFromDb,
  getSavedRanking,
} from './db.js'
import { loadMovies } from './movieStore.js'

// Merges static movie metadata with a movieId -> { eloRating, timesRanked }
// state map, defaulting entries missing from the map to 1000/0.
function mergeWithState(staticMovies, state) {
  return staticMovies.map((m) => ({
    ...m,
    eloRating: state.get(m.id)?.eloRating ?? 1000,
    timesRanked: state.get(m.id)?.timesRanked ?? 0,
  }))
}

// Merges the pool's static metadata with its persisted Elo state.
// Returns null if the enriched JSON doesn't exist yet.
export function getMoviesWithState(db, dataDir) {
  const staticMovies = loadMovies(dataDir)
  if (!staticMovies) return null
  return mergeWithState(staticMovies, getAllState(db))
}

// Applies a ranked pack (2-5 movieIds in rank order — fewer than 5 when
// movies were skipped via "Haven't Seen") to the pool's Elo state. Throws if
// the pool or any movie id is unknown.
export function applyRank(db, dataDir, orderedMovieIds) {
  const movies = getMoviesWithState(db, dataDir)
  if (!movies) throw new Error('Movie pool not found')

  const movieMap = new Map(movies.map((m) => [m.id, m]))
  const pack = orderedMovieIds.map((id) => movieMap.get(id))
  if (pack.some((m) => !m)) throw new Error('Invalid movie id in rank request')

  const updatedRatings = rankPack(pack)
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

// Snapshots the pool's current ranking state under `name`, then resets live
// state back to defaults so a fresh ranking run can start from scratch.
// Throws if the pool isn't found or isn't fully ranked yet.
export function saveRanking(db, dataDir, name) {
  const movies = getMoviesWithState(db, dataDir)
  if (!movies) throw new Error('Movie pool not found')
  if (movies.length === 0 || movies.some((m) => m.timesRanked < 1)) {
    throw new Error('Every movie in the pool must be ranked at least once before saving')
  }

  const entries = movies.map((m) => ({
    movieId: m.id,
    eloRating: m.eloRating,
    timesRanked: m.timesRanked,
  }))
  const id = createSavedRanking(db, name, entries)
  resetAllState(db)
  return { id, name }
}

// { id, name, createdAt }[] for every saved snapshot, newest first.
export function listSavedRankings(db) {
  return listSavedRankingsFromDb(db)
}

// A saved snapshot's static metadata + snapshot-time eloRating/timesRanked,
// sorted descending by eloRating. Returns null if the snapshot or the pool's
// static metadata isn't found.
export function getSavedRankingMovies(db, dataDir, id) {
  const staticMovies = loadMovies(dataDir)
  if (!staticMovies) return null

  const saved = getSavedRanking(db, id)
  if (!saved) return null

  const entryMap = new Map(saved.entries.map((e) => [e.movieId, e]))
  const movies = mergeWithState(staticMovies, entryMap).sort(
    (a, b) => b.eloRating - a.eloRating,
  )

  return { id: saved.id, name: saved.name, createdAt: saved.createdAt, movies }
}
