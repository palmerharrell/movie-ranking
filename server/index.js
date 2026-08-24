import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createDb } from './db.js'
import { getMoviesWithState, applyRank, pickCategory } from './rankingService.js'

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

app.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

app.get('/api/movies', (req, res) => {
  const movies = getMoviesWithState(db, DATA_DIR)
  if (!movies) return res.status(404).json({ error: 'Movie pool not found' })
  res.json(movies)
})

app.post('/api/rank', (req, res) => {
  const { movieIds } = req.body
  if (!Array.isArray(movieIds) || movieIds.length !== 5) {
    return res.status(400).json({ error: 'movieIds must be an array of 5 ids' })
  }
  try {
    res.json(applyRank(db, DATA_DIR, movieIds))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.get('/api/category', (req, res) => {
  const category = pickCategory(db, DATA_DIR)
  if (!category) return res.status(404).json({ error: 'Movie pool not found or not enough movies' })
  res.json(category)
})

app.listen(PORT, () => {
  console.log(`Movie Ranking API listening on :${PORT}`)
})
