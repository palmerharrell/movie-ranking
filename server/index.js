import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createDb } from './db.js'
import {
  getMovies,
  saveRanking,
  listSavedRankings,
  getSavedRankingMovies,
  getSharedRankingTopTen,
  ensureShareSlug,
} from './rankingService.js'

dotenv.config({ quiet: true })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db')
const PORT = process.env.PORT || 3001
const API_TOKEN = process.env.API_TOKEN
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173'

if (!API_TOKEN) {
  console.error('Missing API_TOKEN in .env — refusing to start without auth configured.')
  process.exit(1)
}

const db = createDb(DB_PATH)
const app = express()

app.use(express.json())
app.use(cors({ origin: ALLOWED_ORIGIN }))

// Public, unauthenticated (#220) — a shared Top 10 link needs to work for
// anyone who opens it, not just this app's own bearer-token holder.
// Registered before the auth middleware below, and before the authenticated
// `/api/rankings/:id` route so `/api/rankings/share/:slug` doesn't get
// swallowed by `:id`. Deliberately returns far less than the authenticated
// saved-ranking endpoints — see getSharedRankingTopTen.
app.get('/api/rankings/share/:slug', (req, res) => {
  const shared = getSharedRankingTopTen(db, DATA_DIR, req.params.slug)
  if (!shared) return res.status(404).json({ error: 'Shared ranking not found' })
  res.json(shared)
})

app.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

app.get('/api/movies', (req, res) => {
  const family = req.query.family === 'true'
  const popular = req.query.popular === 'true'
  const genre = req.query.genre || null
  const pg13 = req.query.pg13 === 'true'
  const movies = getMovies(DATA_DIR, { family, popular, genre, pg13 })
  if (!movies) return res.status(404).json({ error: 'Movie pool not found' })
  res.json(movies)
})

app.post('/api/rankings', (req, res) => {
  const { name, entries, clientId, subset, pg13 } = req.body
  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required' })
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries must be a non-empty array' })
  }
  try {
    res.json(saveRanking(db, name.trim(), entries, { ownerClientId: clientId, subset, pg13 }))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.get('/api/rankings', (req, res) => {
  const pg13 = req.query.pg13 === undefined ? undefined : req.query.pg13 === 'true'
  res.json(listSavedRankings(db, { subset: req.query.subset || null, pg13 }))
})

app.get('/api/rankings/:id', (req, res) => {
  const saved = getSavedRankingMovies(db, DATA_DIR, req.params.id)
  if (!saved) return res.status(404).json({ error: 'Saved ranking not found' })
  res.json(saved)
})

// Lazily assigns a share slug to a legacy saved ranking that predates
// sharing (#220) — new saves already get one up front (see saveRanking).
app.post('/api/rankings/:id/share', (req, res) => {
  const shareSlug = ensureShareSlug(db, req.params.id)
  if (!shareSlug) return res.status(404).json({ error: 'Saved ranking not found' })
  res.json({ shareSlug })
})

app.listen(PORT, () => {
  console.log(`Movie Ranking API listening on :${PORT}`)
})
