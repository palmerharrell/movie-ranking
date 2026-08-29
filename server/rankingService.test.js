import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb } from './db.js'
import {
  getMoviesWithState,
  applyRank,
  pickCategory,
  saveRanking,
  listSavedRankings,
  getSavedRankingMovies,
} from './rankingService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'data')
const EMPTY_FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'empty')
const EMPTY_POOL_FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'empty-pool')
const FAMILY_FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'family-data')

function freshDb() {
  return createDb(':memory:')
}

test('getMoviesWithState seeds unranked movies at 1000/0', () => {
  const db = freshDb()
  const movies = getMoviesWithState(db, FIXTURES_DIR)
  assert.equal(movies.length, 5)
  for (const m of movies) {
    assert.equal(m.eloRating, 1000)
    assert.equal(m.timesRanked, 0)
  }
})

test('getMoviesWithState returns null when movies.json does not exist', () => {
  const db = freshDb()
  assert.equal(getMoviesWithState(db, EMPTY_FIXTURES_DIR), null)
})

test('applyRank updates elo and timesRanked for the ranked movies', () => {
  const db = freshDb()
  const updated = applyRank(db, FIXTURES_DIR, ['1', '2', '3', '4', '5'])
  assert.equal(updated.length, 5)
  const byId = new Map(updated.map((m) => [m.id, m]))
  assert.equal(byId.get('1').timesRanked, 1)
  assert.ok(byId.get('1').eloRating > 1000, 'rank-1 movie should gain rating')
  assert.ok(byId.get('5').eloRating < 1000, 'rank-5 movie should lose rating')
})

test('applyRank persists state across calls (accumulates timesRanked)', () => {
  const db = freshDb()
  applyRank(db, FIXTURES_DIR, ['1', '2', '3', '4', '5'])
  const second = applyRank(db, FIXTURES_DIR, ['5', '4', '3', '2', '1'])
  const byId = new Map(second.map((m) => [m.id, m]))
  assert.equal(byId.get('1').timesRanked, 2)
})

test('applyRank throws on an unknown movie id', () => {
  const db = freshDb()
  assert.throws(() => applyRank(db, FIXTURES_DIR, ['1', '2', '3', '4', 'nope']))
})

test('applyRank accepts a shrunk pack (fewer than 5 ids, e.g. after skips)', () => {
  const db = freshDb()
  const updated = applyRank(db, FIXTURES_DIR, ['1', '2'])
  const byId = new Map(updated.map((m) => [m.id, m]))
  assert.equal(byId.get('1').timesRanked, 1)
  assert.equal(byId.get('2').timesRanked, 1)
  assert.equal(byId.get('3').timesRanked, 0)
  assert.ok(byId.get('1').eloRating > 1000)
  assert.ok(byId.get('2').eloRating < 1000)
})

test('applyRank throws on a single-movie pack', () => {
  const db = freshDb()
  assert.throws(() => applyRank(db, FIXTURES_DIR, ['1']))
})

test('pickCategory returns a 5-movie category', () => {
  const db = freshDb()
  const category = pickCategory(db, FIXTURES_DIR)
  assert.ok(category)
  assert.equal(category.movies.length, 5)
})

test('getMoviesWithState({ family: true }) excludes non-family-safe and unrated movies', () => {
  const db = freshDb()
  const movies = getMoviesWithState(db, FAMILY_FIXTURES_DIR, { family: true })
  assert.equal(movies.length, 5)
  assert.ok(movies.every((m) => ['G', 'PG', 'PG-13'].includes(m.mpaaRating)))
})

test('getMoviesWithState() without family returns the full pool', () => {
  const db = freshDb()
  const movies = getMoviesWithState(db, FAMILY_FIXTURES_DIR)
  assert.equal(movies.length, 7)
})

test('pickCategory({ family: true }) only draws from family-safe movies', () => {
  const db = freshDb()
  const category = pickCategory(db, FAMILY_FIXTURES_DIR, { family: true })
  assert.ok(category)
  assert.equal(category.movies.length, 5)
  assert.ok(category.movies.every((m) => ['G', 'PG', 'PG-13'].includes(m.mpaaRating)))
})

function rankAllOnce(db) {
  applyRank(db, FIXTURES_DIR, ['1', '2', '3', '4', '5'])
}

function rankFamilyMoviesOnce(db) {
  applyRank(db, FAMILY_FIXTURES_DIR, ['1', '2', '3', '4', '5'])
}

test('saveRanking({ family: true }) only requires the family-safe subset to be ranked', () => {
  const db = freshDb()
  rankFamilyMoviesOnce(db)
  // Non-family movies (6, 7) are left unranked — should not block a
  // family-scoped save.
  assert.doesNotThrow(() => saveRanking(db, FAMILY_FIXTURES_DIR, 'Family Draft', { family: true }))
})

test('saveRanking({ family: true }) throws if the family-safe subset is incomplete', () => {
  const db = freshDb()
  applyRank(db, FAMILY_FIXTURES_DIR, ['1', '2', '3', '4']) // 5 left unranked
  assert.throws(() => saveRanking(db, FAMILY_FIXTURES_DIR, 'Incomplete', { family: true }))
})

test('saveRanking({ family: true }) snapshots and resets only the family-safe subset', () => {
  const db = freshDb()
  rankFamilyMoviesOnce(db)
  applyRank(db, FAMILY_FIXTURES_DIR, ['6', '7']) // non-family progress, should survive the save

  const { id } = saveRanking(db, FAMILY_FIXTURES_DIR, 'Family Draft', { family: true })

  const saved = getSavedRankingMovies(db, FAMILY_FIXTURES_DIR, id)
  assert.equal(saved.movies.length, 5)
  assert.ok(saved.movies.every((m) => ['G', 'PG', 'PG-13'].includes(m.mpaaRating)))

  const liveMovies = getMoviesWithState(db, FAMILY_FIXTURES_DIR)
  const byId = new Map(liveMovies.map((m) => [m.id, m]))
  for (const id of ['1', '2', '3', '4', '5']) {
    assert.equal(byId.get(id).timesRanked, 0, `family movie ${id} should reset`)
  }
  assert.equal(byId.get('6').timesRanked, 1, 'non-family progress should not be reset')
  assert.equal(byId.get('7').timesRanked, 1, 'non-family progress should not be reset')
})

test('saveRanking throws if any movie is unranked', () => {
  const db = freshDb()
  assert.throws(() => saveRanking(db, FIXTURES_DIR, 'Incomplete'))
})

test('saveRanking throws on an empty pool instead of saving vacuously', () => {
  const db = freshDb()
  assert.throws(() => saveRanking(db, EMPTY_POOL_FIXTURES_DIR, 'Empty'))
})

test('saveRanking snapshots state and resets live state to defaults', () => {
  const db = freshDb()
  rankAllOnce(db)

  const { id, name } = saveRanking(db, FIXTURES_DIR, 'My First Ranking')
  assert.ok(id)
  assert.equal(name, 'My First Ranking')

  const liveMovies = getMoviesWithState(db, FIXTURES_DIR)
  for (const m of liveMovies) {
    assert.equal(m.eloRating, 1000)
    assert.equal(m.timesRanked, 0)
  }
})

test('listSavedRankings lists snapshots newest first', () => {
  const db = freshDb()
  rankAllOnce(db)
  saveRanking(db, FIXTURES_DIR, 'First')
  rankAllOnce(db)
  saveRanking(db, FIXTURES_DIR, 'Second')

  const list = listSavedRankings(db)
  assert.equal(list.length, 2)
  assert.equal(list[0].name, 'Second')
  assert.equal(list[1].name, 'First')
})

test('listSavedRankings reports movieCount so partial saves are distinguishable', () => {
  const db = freshDb()
  rankAllOnce(db)
  saveRanking(db, FIXTURES_DIR, 'Full Pool')

  const list = listSavedRankings(db)
  assert.equal(list[0].movieCount, 5)
})

test('getSavedRankingMovies returns snapshot-time state sorted by eloRating descending', () => {
  const db = freshDb()
  rankAllOnce(db)
  const { id } = saveRanking(db, FIXTURES_DIR, 'Snapshot')

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
