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
      owner_client_id TEXT,
      subset TEXT
    )
  `)
  const columns = db.prepare('PRAGMA table_info(saved_rankings)').all()
  if (!columns.some((c) => c.name === 'owner_client_id')) {
    db.exec('ALTER TABLE saved_rankings ADD COLUMN owner_client_id TEXT')
  }
  if (!columns.some((c) => c.name === 'subset')) {
    db.exec('ALTER TABLE saved_rankings ADD COLUMN subset TEXT')
  }
  // Whether the PG-13-and-under toggle (#193) was active for this save — an
  // independent dimension from `subset` (the toggle composes with every
  // subset, rather than being one itself), so it's its own column rather
  // than folded into the `subset` string. 0/1, NULL for rows saved before
  // this column existed (the toggle didn't exist yet, so treated the same
  // as "off" by callers, but kept distinguishable as unknown).
  if (!columns.some((c) => c.name === 'pg13')) {
    db.exec('ALTER TABLE saved_rankings ADD COLUMN pg13 INTEGER')
  }
  return db
}

// Snapshots `entries` ({movieId, eloRating, timesRanked}[]) as a named,
// timestamped ranking, tagged with the browser's client id (see
// src/lib/clientId.js) so a future edit/re-rank feature can restrict changes
// to the ranking's creator, with the subset id it was saved from (#186
// follow-up) so the Load dialog can filter to the active subset, and with
// whether the PG-13-and-under toggle (#193) was active. `subset` is null for
// rankings saved before that tracking existed.
export function createSavedRanking(db, name, entries, ownerClientId, subset, pg13) {
  const result = db
    .prepare('INSERT INTO saved_rankings (name, data, owner_client_id, subset, pg13) VALUES (?, ?, ?, ?, ?)')
    .run(name, JSON.stringify(entries), ownerClientId ?? null, subset ?? null, pg13 ? 1 : 0)
  return result.lastInsertRowid
}

// { id, name, createdAt, movieCount, subset, pg13 }[] for saved snapshots,
// newest first — restricted to one subset when `subset` is given, and/or to
// snapshots saved with (or without) the PG-13-and-under toggle active when
// `pg13` is a boolean. movieCount surfaces whether a snapshot is a
// full-pool or a partial (e.g. Family-scoped) ranking.
export function listSavedRankings(db, { subset, pg13 } = {}) {
  const conditions = []
  const params = []
  if (subset) {
    conditions.push('subset = ?')
    params.push(subset)
  }
  if (pg13 === true || pg13 === false) {
    conditions.push('pg13 = ?')
    params.push(pg13 ? 1 : 0)
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db
    .prepare(
      `SELECT id, name, created_at, data, subset, pg13 FROM saved_rankings ${where} ORDER BY created_at DESC, id DESC`,
    )
    .all(...params)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    movieCount: JSON.parse(r.data).length,
    subset: r.subset,
    pg13: r.pg13 == null ? null : !!r.pg13,
  }))
}

// A saved snapshot's
// { id, name, createdAt, entries, ownerClientId, subset, pg13 } — entries is
// the {movieId, eloRating, timesRanked}[] captured at save time — or null if
// the id doesn't exist.
export function getSavedRanking(db, id) {
  const row = db
    .prepare('SELECT id, name, created_at, data, owner_client_id, subset, pg13 FROM saved_rankings WHERE id = ?')
    .get(id)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    entries: JSON.parse(row.data),
    ownerClientId: row.owner_client_id,
    subset: row.subset,
    pg13: row.pg13 == null ? null : !!row.pg13,
  }
}
