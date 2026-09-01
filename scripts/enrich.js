import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { parseLetterboxdExport } from './parseLetterboxdExport.js'
import { enrichMovieByTitleYear } from './enrichMovie.js'
import { upsertPersonalMovie } from './mergeSourceMovie.js'

dotenv.config({ quiet: true })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const EXPORT_DIR = path.join(ROOT, 'data', 'letterboxd-export')
const OUTPUT_FILE = path.join(ROOT, 'data', 'movies.json')

function loadPool() {
  if (!fs.existsSync(OUTPUT_FILE)) return []
  return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'))
}

async function main() {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    console.error('Missing TMDB_API_KEY in .env — see README for setup steps.')
    process.exit(1)
  }

  const movies = parseLetterboxdExport(EXPORT_DIR)
  if (movies.length === 0) {
    console.error(
      `No movies found in ${EXPORT_DIR}. Drop your Letterboxd export CSVs there first.`,
    )
    process.exit(1)
  }

  // Loaded and merged into rather than overwritten, so movies added by
  // enrich-sources.js (published-list-only entries, or sources[] tags on
  // movies shared with the personal import) survive a re-run of this
  // script when the user re-exports fresh Letterboxd data.
  let pool = loadPool()

  console.log(`Enriching ${movies.length} movies via TMDb...`)
  let count = 0
  for (const [i, movie] of movies.entries()) {
    const fields = await enrichMovieByTitleYear(apiKey, movie.title, movie.year)
    if (!fields) {
      console.warn(`No TMDb match for "${movie.title}" (${movie.year}) — skipping (likely a TV series or other non-movie entry)`)
    } else {
      pool = upsertPersonalMovie(pool, fields, movie.key)
      count++
    }
    if ((i + 1) % 20 === 0) {
      console.log(`  ${i + 1}/${movies.length}`)
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pool, null, 2))
  console.log(`Enriched ${count} personal movies. Pool now has ${pool.length} movies. Wrote to ${OUTPUT_FILE}`)
}

main()
