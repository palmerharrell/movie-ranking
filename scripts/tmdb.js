import { NOTABLE_STUDIOS, KEYWORD_LABELS } from '../src/lib/curatedAttributes.js'

const BASE_URL = 'https://api.themoviedb.org/3'

async function tmdbFetch(apiKey, endpoint, params = {}) {
  const url = new URL(BASE_URL + endpoint)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`TMDb request failed (${res.status}): ${url}`)
  }
  return res.json()
}

export async function searchMovie(apiKey, title, year) {
  const data = await tmdbFetch(apiKey, '/search/movie', { query: title, year })
  return data.results?.[0] || null
}

export async function getMovieDetails(apiKey, tmdbId) {
  return tmdbFetch(apiKey, `/movie/${tmdbId}`, {
    append_to_response: 'credits,keywords',
  })
}

export async function getReleaseDates(apiKey, tmdbId) {
  return tmdbFetch(apiKey, `/movie/${tmdbId}/release_dates`)
}

// US MPAA certification (e.g. "PG-13") from a /release_dates response, or
// null if TMDb has no US certification data for this movie. Prefers a
// theatrical release (release_type 3) when multiple US entries have one.
export function extractUSCertification(releaseDatesResponse) {
  const us = releaseDatesResponse.results?.find((r) => r.iso_3166_1 === 'US')
  const entries = (us?.release_dates || []).filter((r) => r.certification)
  if (entries.length === 0) return null
  const theatrical = entries.find((r) => r.release_type === 3)
  return (theatrical || entries[0]).certification
}

export function toEnrichedFields(details) {
  const director = details.credits?.crew?.find((c) => c.job === 'Director')
  const cast = (details.credits?.cast || [])
    .slice(0, 5)
    .map((c) => c.name)
  const studio = (details.production_companies || [])
    .map((c) => c.name)
    .find((name) => NOTABLE_STUDIOS.includes(name))
  const keywords = (details.keywords?.keywords || [])
    .map((k) => k.name)
    .filter((k) => KEYWORD_LABELS[k])
  return {
    tmdbId: details.id,
    director: director?.name || null,
    genres: (details.genres || []).map((g) => g.name),
    cast,
    posterUrl: details.poster_path
      ? `https://image.tmdb.org/t/p/w342${details.poster_path}`
      : null,
    studio: studio || null,
    collection: details.belongs_to_collection?.name || null,
    originalLanguage: details.original_language || null,
    keywords,
  }
}
