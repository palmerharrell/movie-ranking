import { isFamilyGenre } from '../src/lib/familyMode.js'
import { selectPopular } from '../src/lib/popularMode.js'
import { selectGenreSubset } from '../src/lib/genreSubsets.js'
import { selectPg13OrUnder } from '../src/lib/pg13Mode.js'
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

// The pool's static metadata, optionally restricted to TMDb's "Family"
// genre (#152 — a curation filter, not an MPAA safety guarantee), the
// PG-13-and-under toggle (#193), and/or one top-N-most-voted-on strategy —
// either the overall Popular subset (#104) or a genre/language/keyword
// subset (#150). Family and pg13 are applied first, in that order, so a
// top-N strategy always means "top-N within whatever scope is active" —
// this is what makes Popular/genre subsets combine correctly with Family
// and/or pg13, and it's also why plain `family` (with neither `genre` nor
// `popular` set) falls into the `popular` branch below: Family caps to the
// same top-N by voteCount as every other genre/language subset (#150's
// pattern), same as if `popular` had been passed alongside it. `genre` and
// `popular` are alternate top-N strategies over different match sets, so
// only one ever applies; nothing in the UI sets both, but keeping them
// independent params costs nothing. `pg13`, unlike `genre`/`popular`, isn't
// a top-N strategy — it's a plain filter, same shape as `family`, layered
// on top of whichever subset is active rather than a subset of its own.
// Returns null if the enriched JSON doesn't exist yet. Per-visitor ranking
// state (eloRating/timesRanked) lives in the browser now (#115) — see
// src/lib/localRankingStore.js — so this is metadata only.
export function getMovies(dataDir, { family = false, popular = false, genre = null, pg13 = false } = {}) {
  const staticMovies = loadMovies(dataDir)
  if (!staticMovies) return null
  let result = family ? staticMovies.filter(isFamilyGenre) : staticMovies
  if (pg13) result = selectPg13OrUnder(result)
  if (genre) result = selectGenreSubset(result, genre)
  else if (popular || family) result = selectPopular(result)
  return result
}

// Persists a client-computed ranking snapshot — `entries` is the
// {movieId, eloRating, timesRanked}[] the browser gathered from its own
// local ranking state — tagged with that browser's client id so a future
// edit/re-rank feature can restrict changes to the ranking's creator, with
// the subset id it was saved from so the Load dialog can filter to the
// active subset, and with whether the PG-13-and-under toggle (#193) was
// active — a second, independent dimension from `subset` (the toggle
// composes with every subset rather than being one), so it gets its own
// column rather than folding into the `subset` string.
export function saveRanking(db, name, entries, { ownerClientId, subset, pg13 } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('entries must be a non-empty array')
  }
  const id = createSavedRanking(db, name, entries, ownerClientId ?? null, subset ?? null, !!pg13)
  return { id, name }
}

// { id, name, createdAt, movieCount, subset, pg13 }[] for saved snapshots,
// newest first — restricted to one subset when `subset` is given, and/or to
// snapshots that were (or weren't) saved with the PG-13-and-under toggle
// active when `pg13` is given.
export function listSavedRankings(db, { subset, pg13 } = {}) {
  return listSavedRankingsFromDb(db, { subset, pg13 })
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
