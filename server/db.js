import Database from 'better-sqlite3'

export function createDb(dbPath) {
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS movie_state (
      movie_id TEXT PRIMARY KEY,
      elo_rating REAL NOT NULL DEFAULT 1000,
      times_ranked INTEGER NOT NULL DEFAULT 0
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      data TEXT NOT NULL
    )
  `)
  return db
}

// Map of movie_id -> { eloRating, timesRanked } for every tracked movie.
export function getAllState(db) {
  const rows = db.prepare('SELECT movie_id, elo_rating, times_ranked FROM movie_state').all()
  return new Map(
    rows.map((r) => [r.movie_id, { eloRating: r.elo_rating, timesRanked: r.times_ranked }]),
  )
}

export function upsertState(db, movieId, eloRating, timesRanked) {
  db.prepare(
    `INSERT INTO movie_state (movie_id, elo_rating, times_ranked)
     VALUES (?, ?, ?)
     ON CONFLICT(movie_id) DO UPDATE SET
       elo_rating = excluded.elo_rating,
       times_ranked = excluded.times_ranked`,
  ).run(movieId, eloRating, timesRanked)
}

// Clears all live ranking state back to defaults (eloRating 1000, timesRanked 0).
export function resetAllState(db) {
  db.prepare('DELETE FROM movie_state').run()
}

// Snapshots `entries` ({movieId, eloRating, timesRanked}[]) as a named,
// timestamped ranking. Returns the new snapshot's id.
export function createSavedRanking(db, name, entries) {
  const result = db
    .prepare('INSERT INTO saved_rankings (name, data) VALUES (?, ?)')
    .run(name, JSON.stringify(entries))
  return result.lastInsertRowid
}

// { id, name, createdAt }[] for every saved snapshot, newest first.
export function listSavedRankings(db) {
  const rows = db
    .prepare('SELECT id, name, created_at FROM saved_rankings ORDER BY created_at DESC, id DESC')
    .all()
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }))
}

// A saved snapshot's { id, name, createdAt, entries } — entries is the
// {movieId, eloRating, timesRanked}[] captured at save time — or null if
// the id doesn't exist.
export function getSavedRanking(db, id) {
  const row = db
    .prepare('SELECT id, name, created_at, data FROM saved_rankings WHERE id = ?')
    .get(id)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    entries: JSON.parse(row.data),
  }
}
