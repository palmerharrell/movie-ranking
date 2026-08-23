import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb } from './db.js'
import { getMoviesWithState, applyRank, pickCategoryForList } from './rankingService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'data')

function freshDb() {
  return createDb(':memory:')
}

test('getMoviesWithState seeds unranked movies at 1000/0', () => {
  const db = freshDb()
  const movies = getMoviesWithState(db, FIXTURES_DIR, 'personal')
  assert.equal(movies.length, 5)
  for (const m of movies) {
    assert.equal(m.eloRating, 1000)
    assert.equal(m.timesRanked, 0)
  }
})

test('getMoviesWithState returns null for an unknown list', () => {
  const db = freshDb()
  assert.equal(getMoviesWithState(db, FIXTURES_DIR, 'nope'), null)
})

test('applyRank updates elo and timesRanked for the ranked movies', () => {
  const db = freshDb()
  const updated = applyRank(db, FIXTURES_DIR, 'personal', ['1', '2', '3', '4', '5'])
  assert.equal(updated.length, 5)
  const byId = new Map(updated.map((m) => [m.id, m]))
  assert.equal(byId.get('1').timesRanked, 1)
  assert.ok(byId.get('1').eloRating > 1000, 'rank-1 movie should gain rating')
  assert.ok(byId.get('5').eloRating < 1000, 'rank-5 movie should lose rating')
})

test('applyRank persists state across calls (accumulates timesRanked)', () => {
  const db = freshDb()
  applyRank(db, FIXTURES_DIR, 'personal', ['1', '2', '3', '4', '5'])
  const second = applyRank(db, FIXTURES_DIR, 'personal', ['5', '4', '3', '2', '1'])
  const byId = new Map(second.map((m) => [m.id, m]))
  assert.equal(byId.get('1').timesRanked, 2)
})

test('applyRank throws on an unknown movie id', () => {
  const db = freshDb()
  assert.throws(() => applyRank(db, FIXTURES_DIR, 'personal', ['1', '2', '3', '4', 'nope']))
})

test('applyRank keeps separate state per list_id', () => {
  const db = freshDb()
  applyRank(db, FIXTURES_DIR, 'personal', ['1', '2', '3', '4', '5'])
  const curated = getMoviesWithState(db, FIXTURES_DIR, 'test-list')
  for (const m of curated) {
    assert.equal(m.eloRating, 1000, 'curated list untouched by personal-list ranking')
  }
})

test('pickCategoryForList returns a 5-movie category', () => {
  const db = freshDb()
  const category = pickCategoryForList(db, FIXTURES_DIR, 'personal')
  assert.ok(category)
  assert.equal(category.movies.length, 5)
})
