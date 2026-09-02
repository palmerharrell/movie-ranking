const BASE_URL = import.meta.env.VITE_API_URL
const API_TOKEN = import.meta.env.VITE_API_TOKEN

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error = new Error(body.error || `Request failed (${res.status})`)
    error.status = res.status
    throw error
  }
  return res.json()
}

export function getMovies({ family } = {}) {
  return request(family ? '/api/movies?family=true' : '/api/movies')
}

export function getCategory({ family } = {}) {
  return request(family ? '/api/category?family=true' : '/api/category')
}

export function rankPack(movieIds) {
  return request('/api/rank', {
    method: 'POST',
    body: JSON.stringify({ movieIds }),
  })
}

export function saveRanking(name, { family } = {}) {
  return request('/api/rankings', {
    method: 'POST',
    body: JSON.stringify({ name, family: !!family }),
  })
}

export function resetRanking({ family } = {}) {
  return request('/api/reset', {
    method: 'POST',
    body: JSON.stringify({ family: !!family }),
  })
}

export function getSavedRankings() {
  return request('/api/rankings')
}

export function getSavedRanking(id) {
  return request(`/api/rankings/${id}`)
}
