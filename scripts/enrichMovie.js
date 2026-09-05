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

  const details = await getMovieDetails(apiKey, match.id)
  const fields = toEnrichedFields(details)
  const releaseDates = await getReleaseDates(apiKey, match.id)

  return {
    tmdbId: fields.tmdbId,
    title,
    year,
    decade: decadeOf(year),
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
  }
}
