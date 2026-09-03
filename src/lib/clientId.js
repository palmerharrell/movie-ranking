const CLIENT_ID_KEY = 'movie-ranking:client-id'

// A durable per-browser id, generated once and reused. Not an account — just
// enough for a future edit/re-rank feature to tell "the browser that created
// this saved ranking" apart from everyone else's (see #115).
export function getOrCreateClientId() {
  let id = localStorage.getItem(CLIENT_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(CLIENT_ID_KEY, id)
  }
  return id
}
