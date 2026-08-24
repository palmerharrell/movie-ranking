import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb } from './db.js'
import { getMoviesWithState, applyRank, pickCategory } from './rankingService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'data')
const EMPTY_FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'empty')

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

test('pickCategory returns a 5-movie category', () => {
  const db = freshDb()
  const category = pickCategory(db, FIXTURES_DIR)
  assert.ok(category)
  assert.equal(category.movies.length, 5)
})
