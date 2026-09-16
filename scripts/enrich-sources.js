import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { enrichMovieByTitleYear } from './enrichMovie.js'
import { sourceIdFromFilename, upsertSourceMovie } from './mergeSourceMovie.js'
import { hashFile, loadState, saveState } from './enrichState.js'
import { isExcluded } from './excludedMovies.js'

dotenv.config({ quiet: true })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SOURCES_DIR = path.join(ROOT, 'data', 'sources')
const OUTPUT_FILE = path.join(ROOT, 'data', 'movies.json')
// Tracks a content hash per already-processed source file (#385) — read by
// --changed-only below to skip re-enriching sources nothing has touched
// since last time. Lives in data/ alongside movies.json (droplet-local
// generated state, gitignored, same reasoning as movies.json itself: it
// describes this machine's/droplet's own processing history, not something
// to check into the repo).
const STATE_FILE = path.join(ROOT, 'data', '.enrich-state.json')

function loadPool() {
  if (!fs.existsSync(OUTPUT_FILE)) return []
  const pool = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'))

  // Source-merge dedup matches by tmdbId (see mergeSourceMovie.js), so any
  // pre-migration entry missing it can never match an existing pool entry
  // and would silently get inserted as a duplicate instead of merged.
  if (pool.some((m) => !m.tmdbId)) {
    console.error(
      `${OUTPUT_FILE} has entries with no tmdbId (pre-migration personal-import data). ` +
        'Run `npm run enrich` first to backfill tmdbId before merging sources.',
    )
    process.exit(1)
  }

  return pool
}

async function main() {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    console.error('Missing TMDB_API_KEY in .env — see README for setup steps.')
    process.exit(1)
  }

  // Optional sourceId args (e.g. `node scripts/enrich-sources.js
  // top-british`) restrict the run to just those source files instead of
  // every *.source.json — useful when only one new discover-fetch source
  // (#151) needs merging and re-enriching the other ~50 sources' several
  // thousand already-merged entries would just burn TMDb quota for no
  // change (upsertSourceMovie never overwrites an existing entry's fields
  // on a source-only match anyway). Explicit source ids always force
  // reprocessing regardless of --changed-only below.
  const args = process.argv.slice(2)
  const changedOnly = args.includes('--changed-only')
  const requestedSourceIds = args.filter((a) => a !== '--changed-only')
  const allSourceFiles = fs.existsSync(SOURCES_DIR)
    ? fs.readdirSync(SOURCES_DIR).filter((f) => f.endsWith('.source.json'))
    : []
  let sourceFiles =
    requestedSourceIds.length > 0
      ? allSourceFiles.filter((f) => requestedSourceIds.includes(sourceIdFromFilename(f)))
      : allSourceFiles
  if (sourceFiles.length === 0) {
    console.error(
      requestedSourceIds.length > 0
        ? `No matching *.source.json files found for: ${requestedSourceIds.join(', ')}`
        : `No *.source.json files found in ${SOURCES_DIR}.`,
    )
    process.exit(1)
  }

  // --changed-only (#385, meant for the scheduled droplet job — see
  // server/deploy/README.md) skips any source file whose content hash
  // matches what's already recorded in STATE_FILE from a previous run,
  // instead of re-enriching all ~50 sources' several thousand entries every
  // time nothing changed. Only applies when no explicit sourceIds were
  // given — an explicit id on the command line is a deliberate request to
  // reprocess that source right now.
  const state = loadState(STATE_FILE)
  if (changedOnly && requestedSourceIds.length === 0) {
    sourceFiles = sourceFiles.filter((file) => hashFile(path.join(SOURCES_DIR, file)) !== state[file])
    if (sourceFiles.length === 0) {
      console.log('No source files changed since the last run — nothing to do.')
      return
    }
  }

  let pool = loadPool()

  for (const file of sourceFiles) {
    const sourceId = sourceIdFromFilename(file)
    const entries = JSON.parse(fs.readFileSync(path.join(SOURCES_DIR, file), 'utf-8'))

    console.log(`Enriching ${entries.length} movies from ${sourceId}...`)
    let added = 0
    let merged = 0
    for (const [i, entry] of entries.entries()) {
      const movie = await enrichMovieByTitleYear(apiKey, entry.title, entry.year)
      if (!movie) {
        console.warn(`No TMDb match for "${entry.title}" (${entry.year}) — skipping`)
        continue
      }
      // #391: a movie deliberately pruned out of the pool (see
      // data/excluded-movies.json) must never get silently re-added by a
      // regenerating source-enrichment run.
      if (isExcluded(movie.tmdbId)) {
        console.warn(`"${entry.title}" (${entry.year}) is on the exclusion list — skipping`)
        continue
      }
      const before = pool.length
      const beforeHasSource = pool.some((m) => m.tmdbId === movie.tmdbId && (m.sources || []).includes(sourceId))
      pool = upsertSourceMovie(pool, movie, sourceId)
      if (pool.length > before) added++
      else if (!beforeHasSource) merged++

      if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${entries.length}`)
    }
    console.log(`${sourceId}: ${added} new, ${merged} merged into existing entries`)
    state[file] = hashFile(path.join(SOURCES_DIR, file))
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pool, null, 2))
  saveState(STATE_FILE, state)
  console.log(`Wrote ${pool.length} movies to ${OUTPUT_FILE}`)
}

main()
