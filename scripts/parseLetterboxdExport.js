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

// Pure: takes the export directory, returns a merged array of unique movies.
// { key, title, year, letterboxdRating, liked, reviewed, reviewText }
export function parseLetterboxdExport(exportDir) {
  const ratings = readCsv(path.join(exportDir, 'ratings.csv'))
  const reviews = readCsv(path.join(exportDir, 'reviews.csv'))
  const likes = readCsv(path.join(exportDir, 'likes', 'films.csv'))
  const watched = readCsv(path.join(exportDir, 'watched.csv'))

  const movies = new Map()

  function ensure(row) {
    const k = key(row)
    if (!movies.has(k)) {
      movies.set(k, {
        key: k,
        title: row.Name,
        year: row.Year ? Number(row.Year) : null,
        letterboxdRating: null,
        liked: false,
        reviewed: false,
        reviewText: null,
      })
    }
    return movies.get(k)
  }

  for (const row of watched) ensure(row)
  for (const row of ratings) {
    const movie = ensure(row)
    movie.letterboxdRating = row.Rating ? Number(row.Rating) : null
  }
  for (const row of likes) {
    const movie = ensure(row)
    movie.liked = true
  }
  for (const row of reviews) {
    const movie = ensure(row)
    movie.reviewed = true
    movie.reviewText = row.Review || null
    if (!movie.letterboxdRating && row.Rating) {
      movie.letterboxdRating = Number(row.Rating)
    }
  }

  return [...movies.values()]
}
