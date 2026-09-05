import { isFamilySafe } from '../src/lib/familyMode.js'
import { selectPopular } from '../src/lib/popularMode.js'
import { selectGenreSubset } from '../src/lib/genreSubsets.js'
import {
  createSavedRanking,
  listSavedRankings as listSavedRankingsFromDb,
  getSavedRanking,
} from './db.js'
import { loadMovies } from './movieStore.js'

// Merges static movie metadata with a movieId -> { eloRating, timesRanked }
// entry map, defaulting entries missing from the map to 1000/0.
function mergeWithState(staticMovies, state) {
  return staticMovies.map((m) => ({
    ...m,
    eloRating: state.get(m.id)?.eloRating ?? 1000,
    timesRanked: state.get(m.id)?.timesRanked ?? 0,
  }))
}

// The pool's static metadata, optionally restricted to family-safe (G/PG/
// PG-13, confirmed-rating) movies and/or one top-N-most-voted-on strategy —
// either the overall Popular subset (#104) or a genre/language/keyword
// subset (#150). Family is applied first so a top-N strategy always means
// "top-N within whatever scope is active" — this is what makes Popular/
// genre subsets combine correctly with Family. `genre` and `popular` are
// alternate top-N strategies over different match sets, so only one ever
// applies; nothing in the UI sets both, but keeping them independent params
// costs nothing. Returns null if the enriched JSON doesn't exist yet.
// Per-visitor ranking state (eloRating/timesRanked) lives in the browser now
// (#115) — see src/lib/localRankingStore.js — so this is metadata only.
export function getMovies(dataDir, { family = false, popular = false, genre = null } = {}) {
  const staticMovies = loadMovies(dataDir)
  if (!staticMovies) return null
  let result = family ? staticMovies.filter(isFamilySafe) : staticMovies
  if (genre) result = selectGenreSubset(result, genre)
  else if (popular) result = selectPopular(result)
  return result
}

// Persists a client-computed ranking snapshot — `entries` is the
// {movieId, eloRating, timesRanked}[] the browser gathered from its own
// local ranking state — tagged with that browser's client id so a future
// edit/re-rank feature can restrict changes to the ranking's creator.
export function saveRanking(db, name, entries, { ownerClientId } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('entries must be a non-empty array')
  }
  const id = createSavedRanking(db, name, entries, ownerClientId ?? null)
  return { id, name }
}

// { id, name, createdAt, movieCount }[] for every saved snapshot, newest first.
export function listSavedRankings(db) {
  return listSavedRankingsFromDb(db)
}

// A saved snapshot's static metadata + snapshot-time eloRating/timesRanked,
// sorted descending by eloRating. Only includes movies that were actually
// part of the saved ranking (its `entries`) — not every movie in the
// current pool — so a partial (e.g. Family-scoped) snapshot doesn't get
// padded out with movies that were never part of that run. Returns null if
// the snapshot or the pool's static metadata isn't found.
export function getSavedRankingMovies(db, dataDir, id) {
  const staticMovies = loadMovies(dataDir)
  if (!staticMovies) return null

  const saved = getSavedRanking(db, id)
  if (!saved) return null

  const entryMap = new Map(saved.entries.map((e) => [e.movieId, e]))
  const scopedStaticMovies = staticMovies.filter((m) => entryMap.has(m.id))
  const movies = mergeWithState(scopedStaticMovies, entryMap).sort(
    (a, b) => b.eloRating - a.eloRating,
  )

  return { id: saved.id, name: saved.name, createdAt: saved.createdAt, movies }
}
