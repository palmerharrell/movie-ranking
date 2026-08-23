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

export function getLists() {
  return request('/api/lists')
}

export function getListMovies(listId) {
  return request(`/api/lists/${listId}/movies`)
}

export function getCategory(listId) {
  return request(`/api/lists/${listId}/category`)
}

export function rankFivePack(listId, movieIds) {
  return request(`/api/lists/${listId}/rank`, {
    method: 'POST',
    body: JSON.stringify({ movieIds }),
  })
}
