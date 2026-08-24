import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf-8')
  return parse(raw, { columns: true, skip_empty_lines: true })
}

function key(row) {
  return row['Letterboxd URI'] || `${row.Name}__${row.Year}`
}

// Pure: takes the export directory, returns a deduped array of unique movies.
// { key, title, year }
export function parseLetterboxdExport(exportDir) {
  const watched = readCsv(path.join(exportDir, 'films.csv'))

  const movies = new Map()
  for (const row of watched) {
    const k = key(row)
    if (!movies.has(k)) {
      movies.set(k, { key: k, title: row.Name, year: row.Year ? Number(row.Year) : null })
    }
  }

  return [...movies.values()]
}
