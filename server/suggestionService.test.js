import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb, addSuggestedMovie } from './db.js'
import { addSuggestion, searchForSuggestion } from './suggestionService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, '__fixtures__', 'data')

function freshDb() {
  return createDb(':memory:')
}

// Covers the dedupe check addSuggestion runs before ever calling TMDb — no
// network access needed, since it throws first. FIXTURES_DIR's own movies
// don't carry a tmdbId (see server/__fixtures__/data/movies.json), so the
// "already in movies.json" branch is covered instead by
// rankingService.test.js's getMovies suggestion-merge tests, which exercise
// the same loadAllMovies path this dedupe check reads from.
test('addSuggestion throws for a tmdbId already suggested previously, without calling TMDb', async () => {
  const db = freshDb()
  addSuggestedMovie(db, { id: '555', tmdbId: 555, title: 'Already Suggested', sources: ['user-suggested'] })

  await assert.rejects(
    () => addSuggestion(db, FIXTURES_DIR, 'unused-api-key', 555, 'client-a'),
    /already in the pool/,
  )
})

test('searchForSuggestion returns [] for a blank query, without calling TMDb', async () => {
  assert.deepEqual(await searchForSuggestion('unused-api-key', ''), [])
  assert.deepEqual(await searchForSuggestion('unused-api-key', '   '), [])
})
