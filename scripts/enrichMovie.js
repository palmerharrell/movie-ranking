import {
  searchMovie,
  getMovieDetails,
  getReleaseDates,
  extractUSCertification,
  toEnrichedFields,
} from './tmdb.js'

function decadeOf(year) {
  return year ? `${Math.floor(year / 10) * 10}s` : null
}

// Shared TMDb enrichment for a single {title, year} movie. Returns the
// static-metadata fields (no `id`/`sources` — callers own those) or null if
// TMDb has no match (e.g. a TV series or other non-movie entry).
export async function enrichMovieByTitleYear(apiKey, title, year) {
  const match = await searchMovie(apiKey, title, year)
  if (!match) return null
  return enrichMovieByTmdbId(apiKey, match.id, title, year)
}

// Same enrichment, skipping the ambiguous title/year search — used by the
// Search & Suggest flow (#243), where the caller already resolved a
// specific tmdbId from a candidate list (tmdb.js's searchMovies) rather
// than trusting a single best-guess match. `title`/`year` default to TMDb's
// own values when not supplied by the caller.
export async function enrichMovieByTmdbId(apiKey, tmdbId, title, year) {
  const details = await getMovieDetails(apiKey, tmdbId)
  const fields = toEnrichedFields(details)
  const releaseDates = await getReleaseDates(apiKey, tmdbId)
  const resolvedTitle = title ?? details.title
  const resolvedYear = year ?? (details.release_date ? Number(details.release_date.slice(0, 4)) : null)

  return {
    tmdbId: fields.tmdbId,
    title: resolvedTitle,
    year: resolvedYear,
    decade: decadeOf(resolvedYear),
    director: fields.director,
    genres: fields.genres,
    cast: fields.cast,
    posterUrl: fields.posterUrl,
    mpaaRating: extractUSCertification(releaseDates),
    studio: fields.studio,
    collection: fields.collection,
    originalLanguage: fields.originalLanguage,
    keywords: fields.keywords,
    voteCount: fields.voteCount,
    productionCountries: fields.productionCountries,
  }
}
