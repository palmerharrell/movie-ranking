import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { enrichMovieByTitleYear } from './enrichMovie.js'
import { sourceIdFromFilename, upsertSourceMovie } from './mergeSourceMovie.js'

dotenv.config({ quiet: true })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SOURCES_DIR = path.join(ROOT, 'data', 'sources')
const OUTPUT_FILE = path.join(ROOT, 'data', 'movies.json')

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

  const sourceFiles = fs.existsSync(SOURCES_DIR)
    ? fs.readdirSync(SOURCES_DIR).filter((f) => f.endsWith('.source.json'))
    : []
  if (sourceFiles.length === 0) {
    console.error(`No *.source.json files found in ${SOURCES_DIR}.`)
    process.exit(1)
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
      const before = pool.length
      const beforeHasSource = pool.some((m) => m.tmdbId === movie.tmdbId && (m.sources || []).includes(sourceId))
      pool = upsertSourceMovie(pool, movie, sourceId)
      if (pool.length > before) added++
      else if (!beforeHasSource) merged++

      if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${entries.length}`)
    }
    console.log(`${sourceId}: ${added} new, ${merged} merged into existing entries`)
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pool, null, 2))
  console.log(`Wrote ${pool.length} movies to ${OUTPUT_FILE}`)
}

main()
