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
