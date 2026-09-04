import Database from 'better-sqlite3'

// In-progress ranking state (eloRating/timesRanked) used to live here as a
// shared movie_state table — every visitor read and wrote the same rows,
// which let concurrent visitors interfere with each other's ranking runs.
// That state now lives client-side (see src/lib/localRankingStore.js, #115);
// the server only persists completed, named snapshots.
export function createDb(dbPath) {
  const db = new Database(dbPath)
  db.exec('DROP TABLE IF EXISTS movie_state')
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      data TEXT NOT NULL,
      owner_client_id TEXT
    )
  `)
  const columns = db.prepare('PRAGMA table_info(saved_rankings)').all()
  if (!columns.some((c) => c.name === 'owner_client_id')) {
    db.exec('ALTER TABLE saved_rankings ADD COLUMN owner_client_id TEXT')
  }
  return db
}

// Snapshots `entries` ({movieId, eloRating, timesRanked}[]) as a named,
// timestamped ranking, tagged with the browser's client id (see
// src/lib/clientId.js) so a future edit/re-rank feature can restrict changes
// to the ranking's creator. Returns the new snapshot's id.
export function createSavedRanking(db, name, entries, ownerClientId) {
  const result = db
    .prepare('INSERT INTO saved_rankings (name, data, owner_client_id) VALUES (?, ?, ?)')
    .run(name, JSON.stringify(entries), ownerClientId ?? null)
  return result.lastInsertRowid
}

// { id, name, createdAt, movieCount }[] for every saved snapshot, newest
// first. movieCount surfaces whether a snapshot is a full-pool or a
// partial (e.g. Family-scoped) ranking.
export function listSavedRankings(db) {
  const rows = db
    .prepare('SELECT id, name, created_at, data FROM saved_rankings ORDER BY created_at DESC, id DESC')
    .all()
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    movieCount: JSON.parse(r.data).length,
  }))
}

// A saved snapshot's { id, name, createdAt, entries, ownerClientId } —
// entries is the {movieId, eloRating, timesRanked}[] captured at save time —
// or null if the id doesn't exist.
export function getSavedRanking(db, id) {
  const row = db
    .prepare('SELECT id, name, created_at, data, owner_client_id FROM saved_rankings WHERE id = ?')
    .get(id)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    entries: JSON.parse(row.data),
    ownerClientId: row.owner_client_id,
  }
}
