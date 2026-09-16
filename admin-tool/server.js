import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import dotenv from 'dotenv'
import { searchMovies } from '../scripts/tmdb.js'
import { enrichMovieByTmdbId } from '../scripts/enrichMovie.js'
import { isExcluded } from '../scripts/excludedMovies.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')

// server.js runs with admin-tool/ as its cwd (`cd admin-tool && npm start`),
// but .env lives at the repo root alongside every other TMDb-key consumer
// (scripts/enrich.js, server/index.js) — point dotenv at it explicitly
// rather than relying on its default cwd-relative lookup.
dotenv.config({ path: path.join(REPO_ROOT, '.env'), quiet: true })

const TMDB_API_KEY = process.env.TMDB_API_KEY
if (!TMDB_API_KEY) {
  console.warn('Missing TMDB_API_KEY in .env — the Add view will return 503.')
}

const DATA_DIR = process.env.DATA_DIR || path.join(REPO_ROOT, 'data')
const MOVIES_FILE = path.join(DATA_DIR, 'movies.json')
const EXCLUDED_FILE = path.join(DATA_DIR, 'excluded-movies.json')
const PORT = process.env.ADMIN_TOOL_PORT || 4100

// This tool edits data/movies.json + data/excluded-movies.json directly on
// disk, exactly like scripts/graduateSuggestions.js and
// scripts/pruneUncorroboratedLowVoteMovies.js do — no caching, always
// re-read fresh from disk, same as server/movieStore.js's loadMovies.
function loadMovies() {
  if (!fs.existsSync(MOVIES_FILE)) return []
  return JSON.parse(fs.readFileSync(MOVIES_FILE, 'utf-8'))
}

function saveMovies(movies) {
  fs.writeFileSync(MOVIES_FILE, JSON.stringify(movies, null, 2) + '\n')
}

function loadExcluded() {
  if (!fs.existsSync(EXCLUDED_FILE)) return []
  return JSON.parse(fs.readFileSync(EXCLUDED_FILE, 'utf-8'))
}

function saveExcluded(entries) {
  fs.writeFileSync(EXCLUDED_FILE, JSON.stringify(entries, null, 2) + '\n')
}

// Fields the browse/filter UI actually needs — the full movie.json entry
// also carries cast/keywords/sources/etc. that would just bloat the
// payload over Wi-Fi for no benefit to this tool.
function trimForBrowse(movie) {
  const { tmdbId, title, year, decade, genres, director, posterUrl } = movie
  return { tmdbId, title, year, decade, genres, director, posterUrl }
}

const app = express()
app.use(express.json())

app.get('/api/movies', (req, res) => {
  res.json(loadMovies().map(trimForBrowse))
})

app.get('/api/status', (req, res) => {
  const movies = loadMovies()
  const stat = fs.existsSync(MOVIES_FILE) ? fs.statSync(MOVIES_FILE) : null
  res.json({
    movieCount: movies.length,
    moviesJsonModifiedAt: stat ? stat.mtime.toISOString() : null,
  })
})

app.post('/api/exclude', (req, res) => {
  const { tmdbIds, reason } = req.body || {}
  if (!Array.isArray(tmdbIds) || tmdbIds.length === 0) {
    return res.status(400).json({ error: 'tmdbIds must be a non-empty array' })
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'reason is required' })
  }

  const movies = loadMovies()
  const excluded = loadExcluded()
  const excludedIds = new Set(excluded.map((e) => e.tmdbId))

  let excludedCount = 0
  let skipped = 0
  for (const tmdbId of tmdbIds) {
    if (excludedIds.has(tmdbId)) {
      skipped++
      continue
    }
    const movie = movies.find((m) => m.tmdbId === tmdbId)
    excluded.push({
      tmdbId,
      title: movie ? movie.title : null,
      year: movie ? movie.year : null,
      reason: reason.trim(),
    })
    excludedIds.add(tmdbId)
    excludedCount++
  }

  const remaining = movies.filter((m) => !tmdbIds.includes(m.tmdbId))
  saveMovies(remaining)
  saveExcluded(excluded)

  res.json({ excluded: excludedCount, skipped })
})

app.get('/api/search-tmdb', async (req, res) => {
  if (!TMDB_API_KEY) {
    return res.status(503).json({ error: 'TMDb search is not configured — set TMDB_API_KEY in the repo root .env' })
  }
  const query = (req.query.q || '').trim()
  if (!query) return res.json([])
  try {
    res.json(await searchMovies(TMDB_API_KEY, query))
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.post('/api/add', async (req, res) => {
  if (!TMDB_API_KEY) {
    return res.status(503).json({ error: 'TMDb search is not configured — set TMDB_API_KEY in the repo root .env' })
  }
  const { tmdbId, title, year } = req.body || {}
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId is required' })

  const movies = loadMovies()
  if (movies.some((m) => m.tmdbId === tmdbId)) {
    return res.status(400).json({ error: 'This movie is already in the pool' })
  }
  if (isExcluded(tmdbId)) {
    return res.status(400).json({ error: 'This movie has been excluded from the pool' })
  }

  try {
    const enriched = await enrichMovieByTmdbId(TMDB_API_KEY, tmdbId, title, year)
    if (!enriched) {
      return res.status(502).json({ error: 'TMDb has no data for this movie' })
    }
    const movie = { id: String(enriched.tmdbId), ...enriched, sources: ['user-suggested'] }
    movies.unshift(movie)
    saveMovies(movies)
    res.json(movie)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.use(express.static(path.join(__dirname, 'public')))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Admin tool running at http://localhost:${PORT} (and on your LAN IP, same port)`)
})
