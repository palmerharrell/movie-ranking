import { NOTABLE_STUDIOS, KEYWORD_LABELS } from '../src/lib/curatedAttributes.js'

const BASE_URL = 'https://api.themoviedb.org/3'

// Retries on 429 (rate limited) and 5xx (transient) — a maintainer running
// enrichMovie.js by hand notices and re-runs on failure, but the unattended
// scheduled batch job (#385, enrich-sources.js) has no one watching, so a
// single transient TMDb hiccup shouldn't kill an entire run. Honors TMDb's
// own Retry-After header when present, otherwise a simple exponential
// backoff (1s, 2s, 4s, 8s).
const MAX_RETRIES = 4

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tmdbFetch(apiKey, endpoint, params = {}) {
  const url = new URL(BASE_URL + endpoint)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  }

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    })
    if (res.ok) return res.json()

    const retryable = res.status === 429 || res.status >= 500
    if (!retryable || attempt >= MAX_RETRIES) {
      throw new Error(`TMDb request failed (${res.status}): ${url}`)
    }
    const retryAfterSeconds = Number(res.headers.get('retry-after'))
    const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : 2 ** attempt * 1000
    await sleep(delayMs)
  }
}

export async function searchMovie(apiKey, title, year) {
  const data = await tmdbFetch(apiKey, '/search/movie', { query: title, year })
  return data.results?.[0] || null
}

// Up to `limit` candidate matches for a live title search (#243's Search &
// Suggest), unlike searchMovie's single best-guess result — a person
// confirming which of several same-titled movies they mean needs to see
// more than one option. Minimal fields only (no director/genres/etc.),
// since a full /movie/{id} lookup only happens for whichever candidate gets
// picked (see enrichMovieByTmdbId).
export async function searchMovies(apiKey, query, limit = 5) {
  const data = await tmdbFetch(apiKey, '/search/movie', { query })
  return (data.results || []).slice(0, limit).map((r) => ({
    tmdbId: r.id,
    title: r.title,
    year: r.release_date ? Number(r.release_date.slice(0, 4)) : null,
    posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : null,
  }))
}

export async function getMovieDetails(apiKey, tmdbId) {
  return tmdbFetch(apiKey, `/movie/${tmdbId}`, {
    append_to_response: 'credits,keywords',
  })
}

export async function getReleaseDates(apiKey, tmdbId) {
  return tmdbFetch(apiKey, `/movie/${tmdbId}/release_dates`)
}

// One page (20 results) of /discover/movie sorted by vote_count descending,
// optionally narrowed by TMDb discover filter params (with_genres,
// with_keywords, with_original_language, etc. — see TMDb's discover docs).
export async function discoverMovies(apiKey, params, page) {
  return tmdbFetch(apiKey, '/discover/movie', { sort_by: 'vote_count.desc', page, ...params })
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
    voteCount: details.vote_count ?? null,
    productionCountries: (details.production_countries || []).map((c) => c.iso_3166_1),
  }
}
