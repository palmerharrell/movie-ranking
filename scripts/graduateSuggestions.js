// Folds accumulated Search & Suggest additions (#243) into data/movies.json
// for good (#382), instead of leaving them to pile up indefinitely in the
// droplet's suggested_movies table (server/db.js).
//
// Deliberately a manual, three-step, review-in-the-middle flow rather than
// a fully automatic job — the issue this implements called out that a
// silent auto-merge risks pulling in low-quality suggestions with no human
// check, and #383 already established the pattern this follows (explicit
// scripts, no automatic push back to the droplet):
//
//   1. `node scripts/graduateSuggestions.js list`
//      Prints every pending suggestion (title, year, tmdbId) for review.
//      Read-only — makes no changes anywhere.
//
//   2. `node scripts/graduateSuggestions.js graduate`
//      Folds every currently-pending suggestion into the LOCAL
//      data/movies.json (via the same upsertSourceMovie dedup-by-tmdbId
//      logic enrich-sources.js uses — no TMDb re-fetch needed, since a
//      suggestion is already fully enriched). Only touches this machine's
//      copy — data/movies.json is gitignored (a generated build artifact,
//      not checked into the repo), so there's no diff to commit.
//
//   3. Push the updated movies.json to the droplet (see
//      server/deploy/README.md's "Pulling pool data down" section — pushing
//      is a deliberate one-off rsync, not part of routine deploys).
//
//   4. `node scripts/graduateSuggestions.js clear <tmdbId> [tmdbId...]`
//      (or `clear-all` for every currently-pending suggestion)
//      Deletes the now-redundant rows from the droplet's suggested_movies
//      table via DELETE /api/suggestions/:tmdbId. Only run this AFTER step 3
//      — loadAllMovies concatenates movies.json with suggested_movies with
//      no dedup of its own, so clearing a row before its movies.json entry
//      has actually reached the droplet would make that movie briefly
//      vanish from the live pool entirely, and clearing it before the local
//      graduate step would lose it altogether.
//
// Usage: API_BASE_URL=https://api.example.com API_TOKEN=... node scripts/graduateSuggestions.js <list|graduate|clear|clear-all> [tmdbIds...]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { upsertSourceMovie } from './mergeSourceMovie.js'
import { isExcluded } from './excludedMovies.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MOVIES_FILE = path.join(__dirname, '..', 'data', 'movies.json')
const SUGGESTION_SOURCE_ID = 'user-suggested'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Set ${name} in the environment.`)
    process.exit(1)
  }
  return value
}

async function apiFetch(apiBaseUrl, apiToken, apiPath, options = {}) {
  const res = await fetch(`${apiBaseUrl}${apiPath}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${apiToken}` },
  })
  if (!res.ok && res.status !== 204) {
    const body = await res.text()
    throw new Error(`${options.method || 'GET'} ${apiPath} failed: ${res.status} ${body}`)
  }
  return res
}

// Reads the raw suggested_movies rows via GET /api/suggestions, not
// GET /api/movies filtered by source tag — once a suggestion graduates, its
// movies.json entry keeps the same 'user-suggested' tag forever, so that
// filter can't distinguish "still pending" from "already graduated" once
// both exist (see the endpoint's own comment in server/index.js).
async function getPendingSuggestions(apiBaseUrl, apiToken) {
  const res = await apiFetch(apiBaseUrl, apiToken, '/api/suggestions')
  return res.json()
}

function loadLocalPool() {
  if (!fs.existsSync(MOVIES_FILE)) {
    console.error(`${MOVIES_FILE} does not exist.`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(MOVIES_FILE, 'utf-8'))
}

async function runList(apiBaseUrl, apiToken) {
  const pending = await getPendingSuggestions(apiBaseUrl, apiToken)
  if (pending.length === 0) {
    console.log('No pending suggestions.')
    return
  }
  console.log(`${pending.length} pending suggestion(s):`)
  for (const m of pending) {
    console.log(`  ${m.title} (${m.year}) — tmdbId ${m.tmdbId}`)
  }
  console.log('\nRun with `graduate` to fold these into the local data/movies.json.')
}

async function runGraduate(apiBaseUrl, apiToken) {
  const pending = await getPendingSuggestions(apiBaseUrl, apiToken)
  if (pending.length === 0) {
    console.log('No pending suggestions to graduate.')
    return
  }

  // #391: defense in depth — a suggestion normally can't be added in the
  // first place once its tmdbId is excluded (see
  // server/suggestionService.js's addSuggestion), but a suggestion could
  // already be sitting pending from before it was added to the exclusion
  // list, so skip it here too rather than folding it into movies.json.
  const toGraduate = pending.filter((m) => !isExcluded(m.tmdbId))
  const skipped = pending.filter((m) => isExcluded(m.tmdbId))

  let pool = loadLocalPool()
  for (const movie of toGraduate) {
    pool = upsertSourceMovie(pool, movie, SUGGESTION_SOURCE_ID)
  }
  fs.writeFileSync(MOVIES_FILE, JSON.stringify(pool, null, 2) + '\n')

  console.log(`Folded ${toGraduate.length} suggestion(s) into ${MOVIES_FILE}:`)
  for (const m of toGraduate) {
    console.log(`  ${m.title} (${m.year}) — tmdbId ${m.tmdbId}`)
  }
  if (skipped.length > 0) {
    console.log(`\nSkipped ${skipped.length} suggestion(s) on the exclusion list (not folded in):`)
    for (const m of skipped) {
      console.log(`  ${m.title} (${m.year}) — tmdbId ${m.tmdbId}`)
    }
  }
  console.log(
    '\nNext: push data/movies.json to the droplet (see server/deploy/README.md), ' +
      'then run `clear-all` (or `clear <tmdbId...>`) to remove these from the ' +
      'droplet’s suggested_movies table.',
  )
}

async function runClear(apiBaseUrl, apiToken, tmdbIds) {
  if (tmdbIds.length === 0) {
    console.error('Provide at least one tmdbId, or use `clear-all`.')
    process.exit(1)
  }
  for (const tmdbId of tmdbIds) {
    await apiFetch(apiBaseUrl, apiToken, `/api/suggestions/${tmdbId}`, { method: 'DELETE' })
    console.log(`Cleared tmdbId ${tmdbId} from suggested_movies.`)
  }
}

async function runClearAll(apiBaseUrl, apiToken) {
  const pending = await getPendingSuggestions(apiBaseUrl, apiToken)
  if (pending.length === 0) {
    console.log('No pending suggestions to clear.')
    return
  }
  await runClear(
    apiBaseUrl,
    apiToken,
    pending.map((m) => m.tmdbId),
  )
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const apiBaseUrl = requireEnv('API_BASE_URL')
  const apiToken = requireEnv('API_TOKEN')

  if (command === 'list' || !command) {
    await runList(apiBaseUrl, apiToken)
  } else if (command === 'graduate') {
    await runGraduate(apiBaseUrl, apiToken)
  } else if (command === 'clear') {
    await runClear(apiBaseUrl, apiToken, rest.map(Number))
  } else if (command === 'clear-all') {
    await runClearAll(apiBaseUrl, apiToken)
  } else {
    console.error(`Unknown command: ${command}. Use list, graduate, clear, or clear-all.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
