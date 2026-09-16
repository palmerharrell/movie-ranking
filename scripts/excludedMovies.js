import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXCLUDED_MOVIES_FILE = path.join(__dirname, '..', 'data', 'excluded-movies.json')

// data/excluded-movies.json (#391) is a git-tracked, hand-curated exclusion
// list — unlike data/movies.json (gitignored, regenerated), this records a
// durable decision that a given tmdbId should never re-enter the pool, so a
// scheduled/regenerating enrichment run can't silently undo a manual prune
// (see scripts/pruneUncorroboratedLowVoteMovies.js, whose one-off deletions
// weren't durable for exactly this reason — nothing recorded which movies
// were excluded or why, so the next enrich-sources.js run re-added them).
// Each entry: { tmdbId, title, year, reason } — reason is free text, not an
// enum, so the record stays useful for a human auditing why something was
// kept out.
let cachedIds = null

function loadExcludedIds() {
  if (cachedIds) return cachedIds
  if (!fs.existsSync(EXCLUDED_MOVIES_FILE)) {
    cachedIds = new Set()
    return cachedIds
  }
  const entries = JSON.parse(fs.readFileSync(EXCLUDED_MOVIES_FILE, 'utf-8'))
  cachedIds = new Set(entries.map((e) => e.tmdbId))
  return cachedIds
}

// Every entry point that can add a movie to the pool (enrich-sources.js,
// enrich.js, server/suggestionService.js's addSuggestion,
// graduateSuggestions.js's graduate command) checks this before letting a
// tmdbId in.
export function isExcluded(tmdbId) {
  return loadExcludedIds().has(tmdbId)
}
