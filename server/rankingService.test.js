import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb } from './db.js'
import { getMovies, saveRanking, listSavedRankings, getSavedRankingMovies } from './rankingService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'data')
const EMPTY_FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'empty')
const FAMILY_FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'family-data')
const GROWN_FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'grown-data')
const POPULAR_FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'popular-data')

function freshDb() {
  return createDb(':memory:')
}

function fullPoolEntries() {
  return ['1', '2', '3', '4', '5'].map((id) => ({ movieId: id, eloRating: 1000, timesRanked: 1 }))
}

test('getMovies returns the pool\'s static metadata', () => {
  const movies = getMovies(FIXTURES_DIR)
  assert.equal(movies.length, 5)
})

test('getMovies returns null when movies.json does not exist', () => {
  assert.equal(getMovies(EMPTY_FIXTURES_DIR), null)
})

test('getMovies({ family: true }) restricts to movies with the TMDb Family genre (#152)', () => {
  const movies = getMovies(FAMILY_FIXTURES_DIR, { family: true })
  assert.equal(movies.length, 4)
  assert.ok(movies.every((m) => m.genres.includes('Family')))
})

test('getMovies({ family: true }) has no MPAA safety floor — an R-rated Family-genre movie still qualifies (#152)', () => {
  const movies = getMovies(FAMILY_FIXTURES_DIR, { family: true })
  assert.ok(movies.some((m) => m.id === '2' && m.mpaaRating === 'R'))
})

test('getMovies() without family returns the full pool', () => {
  const movies = getMovies(FAMILY_FIXTURES_DIR)
  assert.equal(movies.length, 7)
})

test('getMovies({ popular: true }) sorts by voteCount descending, treating null as 0', () => {
  const movies = getMovies(POPULAR_FIXTURES_DIR, { popular: true })
  assert.deepEqual(movies.map((m) => m.id), ['2', '1', '5', '3', '4'])
})

test('getMovies({ family: true, popular: true }) applies family first, then top-N within that scope', () => {
  const movies = getMovies(POPULAR_FIXTURES_DIR, { family: true, popular: true })
  // Movie 5 has no Family genre, excluded by family before the popular sort
  // ever sees it — despite its G rating, which would have qualified it
  // under the old MPAA-based filter.
  assert.deepEqual(movies.map((m) => m.id), ['2', '1', '4'])
})

test('getMovies({ family: true }) alone also caps to the top-N by voteCount, same as the other genre subsets (#150)', () => {
  const movies = getMovies(POPULAR_FIXTURES_DIR, { family: true })
  assert.deepEqual(movies.map((m) => m.id), ['2', '1', '4'])
})

test('getMovies({ genre: "comedy" }) filters to that genre, sorted by voteCount descending (#150)', () => {
  const movies = getMovies(POPULAR_FIXTURES_DIR, { genre: 'comedy' })
  assert.deepEqual(movies.map((m) => m.id), ['2', '1', '5'])
})

test('getMovies({ genre }) takes precedence over popular when both are set', () => {
  const movies = getMovies(POPULAR_FIXTURES_DIR, { genre: 'comedy', popular: true })
  assert.deepEqual(movies.map((m) => m.id), ['2', '1', '5'])
})

test('saveRanking persists a client-computed snapshot', () => {
  const db = freshDb()
  const { id, name } = saveRanking(db, 'My First Ranking', fullPoolEntries())
  assert.ok(id)
  assert.equal(name, 'My First Ranking')
})

test('saveRanking stamps the snapshot with the given owner client id', () => {
  const db = freshDb()
  const { id } = saveRanking(db, 'Mine', fullPoolEntries(), { ownerClientId: 'client-abc' })
  const saved = getSavedRankingMovies(db, FIXTURES_DIR, id)
  assert.ok(saved)
})

test('saveRanking throws on empty entries', () => {
  const db = freshDb()
  assert.throws(() => saveRanking(db, 'Empty', []))
})

test('listSavedRankings lists snapshots newest first', () => {
  const db = freshDb()
  saveRanking(db, 'First', fullPoolEntries())
  saveRanking(db, 'Second', fullPoolEntries())

  const list = listSavedRankings(db)
  assert.equal(list.length, 2)
  assert.equal(list[0].name, 'Second')
  assert.equal(list[1].name, 'First')
})

test('listSavedRankings reports movieCount so partial saves are distinguishable', () => {
  const db = freshDb()
  saveRanking(db, 'Full Pool', fullPoolEntries())

  const list = listSavedRankings(db)
  assert.equal(list[0].movieCount, 5)
})

test('saveRanking stamps the snapshot with the given subset id', () => {
  const db = freshDb()
  saveRanking(db, 'Sci-Fi Run', fullPoolEntries(), { subset: 'sci-fi' })

  const list = listSavedRankings(db)
  assert.equal(list[0].subset, 'sci-fi')
})

test('listSavedRankings({ subset }) restricts to snapshots saved from that subset', () => {
  const db = freshDb()
  saveRanking(db, 'All Run', fullPoolEntries(), { subset: 'all' })
  saveRanking(db, 'Family Run', fullPoolEntries(), { subset: 'family' })
  saveRanking(db, 'Another Family Run', fullPoolEntries(), { subset: 'family' })

  const list = listSavedRankings(db, { subset: 'family' })
  assert.equal(list.length, 2)
  assert.ok(list.every((r) => r.subset === 'family'))
})

test('listSavedRankings({ subset }) excludes snapshots saved before subset tracking existed', () => {
  const db = freshDb()
  saveRanking(db, 'Legacy Run', fullPoolEntries())

  const list = listSavedRankings(db, { subset: 'all' })
  assert.equal(list.length, 0)
})

test('getSavedRankingMovies returns snapshot-time state sorted by eloRating descending', () => {
  const db = freshDb()
  const entries = [
    { movieId: '1', eloRating: 1050, timesRanked: 1 },
    { movieId: '2', eloRating: 1020, timesRanked: 1 },
    { movieId: '3', eloRating: 990, timesRanked: 1 },
    { movieId: '4', eloRating: 970, timesRanked: 1 },
    { movieId: '5', eloRating: 940, timesRanked: 1 },
  ]
  const { id } = saveRanking(db, 'Snapshot', entries)

  const saved = getSavedRankingMovies(db, FIXTURES_DIR, id)
  assert.equal(saved.name, 'Snapshot')
  assert.equal(saved.movies.length, 5)
  for (let i = 1; i < saved.movies.length; i++) {
    assert.ok(saved.movies[i - 1].eloRating >= saved.movies[i].eloRating)
  }
})

test('getSavedRankingMovies returns null for an unknown id', () => {
  const db = freshDb()
  assert.equal(getSavedRankingMovies(db, FIXTURES_DIR, 999), null)
})

test('getSavedRankingMovies stays frozen when the pool grows after save (#51)', () => {
  const db = freshDb()
  const { id } = saveRanking(db, 'Snapshot', fullPoolEntries())

  // Simulate the pool having grown (e.g. via enrich-sources.js) since the
  // snapshot was taken, by reading the saved snapshot back against a data
  // dir with an extra movie the snapshot never saw.
  const saved = getSavedRankingMovies(db, GROWN_FIXTURES_DIR, id)
  assert.equal(saved.movies.length, 5, 'movie added to the pool after save must not appear')
  assert.ok(!saved.movies.some((m) => m.id === '6'))
})
