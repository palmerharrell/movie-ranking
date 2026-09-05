import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { getMovieDetails, toEnrichedFields } from './tmdb.js'

dotenv.config({ quiet: true })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUTPUT_FILE = path.join(ROOT, 'data', 'movies.json')

// One-time refresh for movies.json entries enriched before a
// getMovieDetails-derived field existed or a curated allowlist
// (NOTABLE_STUDIOS/KEYWORD_LABELS) changed — e.g. `voteCount` (#104) and the
// `musical`/`rock musical` keywords (#150). enrich-sources.js never
// overwrites an existing entry's fields on a source-only match
// (mergeSourceMovie.js's upsertSourceMovie), so a movie already in the pool
// before an allowlist change would otherwise never pick it up. Unlike
// enrich.js/enrich-sources.js, this only calls getMovieDetails per movie
// (skipping searchMovie/getReleaseDates, since every existing entry already
// has tmdbId and mpaaRating isn't derived from this endpoint) — one TMDb
// call per movie instead of the full pipeline. New movies get every field
// fresh via enrich.js/enrich-sources.js automatically; this script is only
// for backfilling movies already in the pool.
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
    const fields = toEnrichedFields(details)
    Object.assign(movie, {
      director: fields.director,
      genres: fields.genres,
      cast: fields.cast,
      posterUrl: fields.posterUrl,
      studio: fields.studio,
      collection: fields.collection,
      originalLanguage: fields.originalLanguage,
      keywords: fields.keywords,
      voteCount: fields.voteCount,
    })
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${pool.length}`)
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pool, null, 2))
  console.log(`Refreshed enriched fields for ${pool.length} movies in ${OUTPUT_FILE}`)
}

main()
