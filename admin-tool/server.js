import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import express from 'express'
import dotenv from 'dotenv'
import { searchMovies } from '../scripts/tmdb.js'
import { enrichMovieByTmdbId } from '../scripts/enrichMovie.js'
import { isExcluded } from '../scripts/excludedMovies.js'

const execFileAsync = promisify(execFile)

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

// Same SSH alias documented in the "Droplet SSH access" setup — rsync
// happily takes an SSH config Host alias in place of user@host, so no new
// config is needed for the common case. REMOTE_DATA_DIR matches the path
// server/deploy/deploy.sh and pull-pool-data.sh already assume.
//
// `env ?? default` (not `||`) deliberately distinguishes "unset, use the
// default" from "explicitly set to an empty string" — the latter is almost
// certainly a mistake (e.g. a template that forgot to fill in a value), and
// with `||` it would silently fall through to the real droplet instead of
// failing loudly. An empty-but-defined override fails fast at startup
// rather than quietly pushing somewhere unintended.
function requireNonEmptyEnv(name, fallback) {
  const value = process.env[name]
  if (value === undefined) return fallback
  if (!value.trim()) {
    throw new Error(`${name} is set but empty — unset it to use the default, or provide a real value.`)
  }
  return value
}

const DROPLET_HOST = requireNonEmptyEnv('DROPLET_HOST', 'movie-ranking-droplet')
const REMOTE_DATA_DIR = requireNonEmptyEnv('REMOTE_DATA_DIR', '/opt/movie-ranking/data')

// #399: pushes only the two files this tool itself edits — never the whole
// data/ directory — so a push can't accidentally carry along unrelated
// local-only content (e.g. data/letterboxd-export/). `-i` (itemize changes)
// gives a human-readable diff-style line per file even under --dry-run, so
// the preview step has something meaningful to show before a real push.
function rsyncPushArgs(dryRun) {
  const args = ['-az', '-i']
  if (dryRun) args.push('--dry-run')
  args.push(MOVIES_FILE, EXCLUDED_FILE, `${DROPLET_HOST}:${REMOTE_DATA_DIR}/`)
  return args
}

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

// Shared by /api/add and /api/unexclude — both land a TMDb-resolved movie
// straight into movies.json the same way. Returns the new movie object, or
// throws if TMDb has no data for it.
async function enrichAndAddMovie(movies, tmdbId, title, year) {
  const enriched = await enrichMovieByTmdbId(TMDB_API_KEY, tmdbId, title, year)
  if (!enriched) {
    throw new Error('TMDb has no data for this movie')
  }
  const movie = { id: String(enriched.tmdbId), ...enriched, sources: ['user-suggested'] }
  movies.unshift(movie)
  saveMovies(movies)
  return movie
}

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
    const movie = await enrichAndAddMovie(movies, tmdbId, title, year)
    res.json(movie)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.get('/api/excluded', (req, res) => {
  res.json(loadExcluded())
})

app.post('/api/unexclude', async (req, res) => {
  if (!TMDB_API_KEY) {
    return res.status(503).json({ error: 'TMDb search is not configured — set TMDB_API_KEY in the repo root .env' })
  }
  const { tmdbId } = req.body || {}
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId is required' })

  const excluded = loadExcluded()
  const entry = excluded.find((e) => e.tmdbId === tmdbId)
  if (!entry) {
    return res.status(404).json({ error: 'This movie is not on the exclusion list' })
  }

  const movies = loadMovies()
  if (movies.some((m) => m.tmdbId === tmdbId)) {
    // Already back in the pool somehow — just drop the stale exclusion entry.
    saveExcluded(excluded.filter((e) => e.tmdbId !== tmdbId))
    return res.json(movies.find((m) => m.tmdbId === tmdbId))
  }

  try {
    const movie = await enrichAndAddMovie(movies, tmdbId, entry.title, entry.year)
    saveExcluded(excluded.filter((e) => e.tmdbId !== tmdbId))
    res.json(movie)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.post('/api/push/preview', async (req, res) => {
  try {
    const { stdout } = await execFileAsync('rsync', rsyncPushArgs(true))
    res.json({ output: stdout.trim(), changed: stdout.trim().length > 0 })
  } catch (err) {
    res.status(502).json({ error: err.stderr?.trim() || err.message })
  }
})

app.post('/api/push/execute', async (req, res) => {
  try {
    const { stdout } = await execFileAsync('rsync', rsyncPushArgs(false))
    res.json({ output: stdout.trim() })
  } catch (err) {
    res.status(502).json({ error: err.stderr?.trim() || err.message })
  }
})

app.use(express.static(path.join(__dirname, 'public')))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Admin tool running at http://localhost:${PORT} (and on your LAN IP, same port)`)
})
