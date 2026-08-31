import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { parseLetterboxdExport } from './parseLetterboxdExport.js'
import { enrichMovieByTitleYear } from './enrichMovie.js'

dotenv.config({ quiet: true })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const EXPORT_DIR = path.join(ROOT, 'data', 'letterboxd-export')
const OUTPUT_FILE = path.join(ROOT, 'data', 'movies.json')

async function enrichMovie(apiKey, movie) {
  const fields = await enrichMovieByTitleYear(apiKey, movie.title, movie.year)
  if (!fields) {
    console.warn(`No TMDb match for "${movie.title}" (${movie.year}) — skipping (likely a TV series or other non-movie entry)`)
    return null
  }
  return {
    id: movie.key,
    ...fields,
    sources: ['personal'],
  }
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

  console.log(`Enriching ${movies.length} movies via TMDb...`)
  const enriched = []
  for (const [i, movie] of movies.entries()) {
    const result = await enrichMovie(apiKey, movie)
    if (result) enriched.push(result)
    if ((i + 1) % 20 === 0) {
      console.log(`  ${i + 1}/${movies.length}`)
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enriched, null, 2))
  console.log(`Wrote ${enriched.length} movies to ${OUTPUT_FILE}`)
}

main()
