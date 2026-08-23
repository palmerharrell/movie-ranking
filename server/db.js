import Database from 'better-sqlite3'

export function createDb(dbPath) {
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS movie_state (
      list_id TEXT NOT NULL,
      movie_id TEXT NOT NULL,
      elo_rating REAL NOT NULL DEFAULT 1000,
      times_ranked INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (list_id, movie_id)
    )
  `)
  return db
}

// Map of movie_id -> { eloRating, timesRanked } for every tracked movie in a list.
export function getAllState(db, listId) {
  const rows = db
    .prepare('SELECT movie_id, elo_rating, times_ranked FROM movie_state WHERE list_id = ?')
    .all(listId)
  return new Map(
    rows.map((r) => [r.movie_id, { eloRating: r.elo_rating, timesRanked: r.times_ranked }]),
  )
}

export function upsertState(db, listId, movieId, eloRating, timesRanked) {
  db.prepare(
    `INSERT INTO movie_state (list_id, movie_id, elo_rating, times_ranked)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(list_id, movie_id) DO UPDATE SET
       elo_rating = excluded.elo_rating,
       times_ranked = excluded.times_ranked`,
  ).run(listId, movieId, eloRating, timesRanked)
}
