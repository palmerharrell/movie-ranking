import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { discoverMovies } from './tmdb.js'

dotenv.config({ quiet: true })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SOURCES_DIR = path.join(__dirname, '..', 'data', 'sources')

const PAGES = 15 // 20 results/page * 15 = top 300 by vote_count
const PAGE_SIZE = 20

// Genre ids and the `musical`/`rock musical` keyword ids confirmed live
// against TMDb's /genre/movie/list and /search/keyword during planning
// (#150) — not guessed. TMDb discover's with_genres takes comma-separated
// ids as AND (confirmed live: 10749,35 returns real rom-coms), which is
// what rom-com's two-genre target relies on.
const DISCOVER_TARGETS = [
  { sourceId: 'top-popular', params: {} },
  { sourceId: 'top-comedy', params: { with_genres: '35' } },
  { sourceId: 'top-action', params: { with_genres: '28' } },
  { sourceId: 'top-mystery', params: { with_genres: '9648' } },
  { sourceId: 'top-horror', params: { with_genres: '27' } },
  { sourceId: 'top-sci-fi', params: { with_genres: '878' } },
  { sourceId: 'top-fantasy', params: { with_genres: '14' } },
  { sourceId: 'top-romance', params: { with_genres: '10749' } },
  { sourceId: 'top-rom-com', params: { with_genres: '10749,35' } },
  { sourceId: 'top-musicals', params: { with_keywords: '4344|155710' } },
  { sourceId: 'top-drama', params: { with_genres: '18' } },
  { sourceId: 'top-adventure', params: { with_genres: '12' } },
  { sourceId: 'top-animation', params: { with_genres: '16' } },
  { sourceId: 'top-thriller', params: { with_genres: '53' } },
  { sourceId: 'top-crime', params: { with_genres: '80' } },
  { sourceId: 'top-french', params: { with_original_language: 'fr' } },
  { sourceId: 'top-spanish', params: { with_original_language: 'es' } },
  { sourceId: 'top-italian', params: { with_original_language: 'it' } },
]

function yearFromReleaseDate(releaseDate) {
  return releaseDate ? Number(releaseDate.slice(0, 4)) : null
}

async function fetchTopMovies(apiKey, params) {
  const entries = []
  for (let page = 1; page <= PAGES; page++) {
    const data = await discoverMovies(apiKey, params, page)
    for (const result of data.results ?? []) {
      entries.push({ title: result.title, year: yearFromReleaseDate(result.release_date) })
    }
    if (page >= (data.total_pages ?? PAGES)) break
  }
  return entries.slice(0, PAGES * PAGE_SIZE)
}

// Generates data/sources/<sourceId>.source.json for each DISCOVER_TARGETS
// entry — the top ~300 movies by TMDb vote_count matching that target's
// filter. These are the exact {title, year} shape enrich-sources.js already
// expects; running it afterward merges any we don't already have into
// movies.json (#150). This script only writes source files — it doesn't
// touch movies.json itself.
async function main() {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    console.error('Missing TMDB_API_KEY in .env — see README for setup steps.')
    process.exit(1)
  }
  fs.mkdirSync(SOURCES_DIR, { recursive: true })

  for (const { sourceId, params } of DISCOVER_TARGETS) {
    const entries = await fetchTopMovies(apiKey, params)
    const outputFile = path.join(SOURCES_DIR, `${sourceId}.source.json`)
    fs.writeFileSync(outputFile, JSON.stringify(entries, null, 2))
    console.log(`${sourceId}: wrote ${entries.length} entries to ${outputFile}`)
  }
}

main()
