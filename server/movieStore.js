import fs from 'node:fs'
import path from 'node:path'

// Static metadata for the pool — null if the enriched JSON doesn't exist yet.
export function loadMovies(dataDir) {
  const file = path.join(dataDir, 'movies.json')
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}
