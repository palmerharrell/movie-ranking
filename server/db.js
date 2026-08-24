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
