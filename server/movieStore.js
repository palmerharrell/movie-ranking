import fs from 'node:fs'
import path from 'node:path'

export function loadManifest(dataDir) {
  const file = path.join(dataDir, 'curated-lists', 'manifest.json')
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

// Static movie metadata for a list — null if the enriched JSON doesn't exist yet.
export function loadListMovies(dataDir, listId) {
  const file =
    listId === 'personal'
      ? path.join(dataDir, 'movies.json')
      : path.join(dataDir, 'curated-lists', `${listId}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}
