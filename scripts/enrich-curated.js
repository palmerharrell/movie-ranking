import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { searchMovie, getMovieDetails, toEnrichedFields } from './tmdb.js'

dotenv.config({ quiet: true })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CURATED_DIR = path.join(__dirname, '..', 'data', 'curated-lists')
const MANIFEST_FILE = path.join(CURATED_DIR, 'manifest.json')

function decadeOf(year) {
  return year ? `${Math.floor(year / 10) * 10}s` : null
}

async function enrichEntry(apiKey, entry) {
  const match = await searchMovie(apiKey, entry.title, entry.year)
  if (!match) {
    console.warn(`No TMDb match for "${entry.title}" (${entry.year})`)
    return {
      id: `${entry.title}__${entry.year}`,
      title: entry.title,
      year: entry.year,
      decade: decadeOf(entry.year),
      director: null,
      genres: [],
      cast: [],
      posterUrl: null,
    }
  }
  const details = await getMovieDetails(apiKey, match.id)
  const fields = toEnrichedFields(details)
  return {
    id: `${entry.title}__${entry.year}`,
    title: entry.title,
    year: entry.year,
    decade: decadeOf(entry.year),
    director: fields.director,
    genres: fields.genres,
    cast: fields.cast,
    posterUrl: fields.posterUrl,
  }
}

async function enrichList(apiKey, listId) {
  const sourceFile = path.join(CURATED_DIR, `${listId}.source.json`)
  const entries = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'))

  console.log(`Enriching ${entries.length} movies for "${listId}"...`)
  const enriched = []
  for (const entry of entries) {
    enriched.push(await enrichEntry(apiKey, entry))
  }

  const outputFile = path.join(CURATED_DIR, `${listId}.json`)
  fs.writeFileSync(outputFile, JSON.stringify(enriched, null, 2))
  console.log(`Wrote ${enriched.length} movies to ${outputFile}`)
}

async function main() {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    console.error('Missing TMDB_API_KEY in .env — see README for setup steps.')
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'))
  const curatedLists = manifest.filter((entry) => entry.source === 'curated')

  for (const list of curatedLists) {
    await enrichList(apiKey, list.id)
  }
}

main()
