import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { getMovieDetails } from './tmdb.js'

dotenv.config({ quiet: true })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUTPUT_FILE = path.join(ROOT, 'data', 'movies.json')

// One-time backfill for movies.json entries enriched before `voteCount`
// existed (#104). Unlike enrich.js/enrich-sources.js, this only calls
// getMovieDetails per movie (skipping searchMovie/getReleaseDates/credits/
// keywords, since every existing entry already has tmdbId and those other
// fields) — one TMDb call per movie instead of the full pipeline. Going
// forward, new movies get `voteCount` automatically via enrichMovie.js.
async function main() {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    console.error('Missing TMDB_API_KEY in .env — see README for setup steps.')
    process.exit(1)
  }
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`${OUTPUT_FILE} not found.`)
    process.exit(1)
  }

  const pool = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'))
  const missingTmdbId = pool.filter((m) => !m.tmdbId)
  if (missingTmdbId.length > 0) {
    console.error(
      `${missingTmdbId.length} entries have no tmdbId — run \`npm run enrich\` first.`,
    )
    process.exit(1)
  }

  for (const [i, movie] of pool.entries()) {
    const details = await getMovieDetails(apiKey, movie.tmdbId)
    movie.voteCount = details.vote_count ?? null
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${pool.length}`)
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pool, null, 2))
  console.log(`Backfilled voteCount for ${pool.length} movies in ${OUTPUT_FILE}`)
}

main()
