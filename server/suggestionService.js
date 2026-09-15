import { searchMovies } from '../scripts/tmdb.js'
import { enrichMovieByTmdbId } from '../scripts/enrichMovie.js'
import { addSuggestedMovie, getSuggestedMovies, removeSuggestedMovie } from './db.js'
import { loadMovies } from './movieStore.js'

// The source id every Search & Suggest addition is tagged with (#243) —
// distinct from 'personal' and every published-list source id, so a future
// curation pass (#351) can find and review these separately before folding
// any of them into a real data/sources/*.source.json.
const SUGGESTION_SOURCE_ID = 'user-suggested'

// Up to 5 TMDb candidates for a typed title (#243) — the person picks
// which one they mean from posters/years before anything is added, rather
// than trusting a single best-guess match the way the build-time
// enrichment pipeline does (scripts/enrichMovie.js's enrichMovieByTitleYear)
// — a brand-new addition to the shared pool is worth a one-click human
// confirmation.
export async function searchForSuggestion(apiKey, query) {
  const trimmed = (query || '').trim()
  if (!trimmed) return []
  return searchMovies(apiKey, trimmed)
}

// Enriches the chosen TMDb candidate and persists it (#243). Throws if it's
// already in the pool (movies.json or a prior suggestion) — checked against
// both before the TMDb detail lookup, so a duplicate suggestion fails fast
// without spending an API call. Returns the new movie object, already
// shaped like every other pool entry (id, tmdbId, sources: ['user-suggested'],
// plus the full set of static-metadata fields).
export async function addSuggestion(db, dataDir, apiKey, tmdbId, clientId) {
  const staticMovies = loadMovies(dataDir) || []
  const suggested = getSuggestedMovies(db)
  const alreadyInPool = [...staticMovies, ...suggested].some((m) => m.tmdbId === tmdbId)
  if (alreadyInPool) {
    throw new Error('This movie is already in the pool')
  }

  const enriched = await enrichMovieByTmdbId(apiKey, tmdbId)
  if (!enriched) {
    throw new Error('TMDb has no data for this movie')
  }

  const movie = { id: String(enriched.tmdbId), ...enriched, sources: [SUGGESTION_SOURCE_ID] }
  return addSuggestedMovie(db, movie, clientId)
}

// Removes one suggestion once it's been folded into data/movies.json for
// good and pushed to the droplet (#382, scripts/graduateSuggestions.js) —
// see removeSuggestedMovie in db.js for why this matters. Returns true if a
// matching suggestion was removed, false if tmdbId wasn't a pending
// suggestion.
export function removeSuggestion(db, tmdbId) {
  return removeSuggestedMovie(db, tmdbId)
}
