// Derives a source id from a /data/sources/*.source.json filename, e.g.
// "afi-top-100.source.json" -> "afi-top-100".
export function sourceIdFromFilename(filename) {
  return filename.replace(/\.source\.json$/, '')
}

// Upserts one TMDb-enriched movie (from enrichMovieByTitleYear, plus tmdbId)
// into the existing pool, tagged with sourceId. Matches existing pool
// entries by tmdbId (not `id` — the personal-import pool keys `id` off the
// Letterboxd URI, not TMDb ID). Pure: returns a new array, does not mutate
// `pool`.
//
// - Already in the pool (any source): source id appended to its sources[]
//   if not already present; every other field left untouched so a
//   published-list match never overwrites personal-import data.
// - Not yet in the pool: added as a new entry, `id` = its tmdbId (it has no
//   Letterboxd URI to key off), sources: [sourceId].
export function upsertSourceMovie(pool, movie, sourceId) {
  const index = pool.findIndex((m) => m.tmdbId === movie.tmdbId)
  if (index === -1) {
    return [...pool, { id: String(movie.tmdbId), ...movie, sources: [sourceId] }]
  }

  const existing = pool[index]
  const existingSources = existing.sources || []
  if (existingSources.includes(sourceId)) return pool

  const updated = { ...existing, sources: [...existingSources, sourceId] }
  return [...pool.slice(0, index), updated, ...pool.slice(index + 1)]
}

// Upserts one TMDb-enriched personal-import movie into the existing pool.
// Unlike upsertSourceMovie, this is the *authoritative* refresh for a
// movie's static metadata (enrich.js re-running is how personal-import data
// gets updated), so on a match it overwrites fields with the freshly
// enriched ones rather than leaving them untouched — but keeps the
// existing `id` (a source-only match won't have a Letterboxd URI to key
// off, and re-keying would invalidate any ranking progress stored against
// that id) and unions in 'personal' rather than replacing sources[].
//
// Matches by `id === key` (its Letterboxd URI) as well as tmdbId — not
// tmdbId alone — because a pre-migration personal entry has no tmdbId yet
// on the very re-run that's supposed to backfill it; matching by tmdbId
// only would never find it and would insert a duplicate instead of
// updating it in place.
//
// - Already in the pool (any source): fields refreshed, 'personal' added
//   to sources[] if not already present, existing `id` preserved.
// - Not yet in the pool: added as a new entry keyed by `key` (its
//   Letterboxd URI), sources: ['personal'].
export function upsertPersonalMovie(pool, movie, key) {
  const index = pool.findIndex((m) => m.id === key || m.tmdbId === movie.tmdbId)
  if (index === -1) {
    return [...pool, { id: key, ...movie, sources: ['personal'] }]
  }

  const existing = pool[index]
  const existingSources = existing.sources || []
  const sources = existingSources.includes('personal')
    ? existingSources
    : [...existingSources, 'personal']

  const updated = { ...existing, ...movie, id: existing.id, sources }
  return [...pool.slice(0, index), updated, ...pool.slice(index + 1)]
}
