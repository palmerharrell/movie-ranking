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
    append_to_response: 'credits',
  })
}

export function toEnrichedFields(details) {
  const director = details.credits?.crew?.find((c) => c.job === 'Director')
  const cast = (details.credits?.cast || [])
    .slice(0, 5)
    .map((c) => c.name)
  return {
    tmdbId: details.id,
    director: director?.name || null,
    genres: (details.genres || []).map((g) => g.name),
    cast,
    posterUrl: details.poster_path
      ? `https://image.tmdb.org/t/p/w342${details.poster_path}`
      : null,
  }
}
