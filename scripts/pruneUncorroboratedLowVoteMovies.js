import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUTPUT_FILE = path.join(ROOT, 'data', 'movies.json')

// Drops movies from movies.json whose only source is the given sourceId and
// whose voteCount is below the given threshold (#213) — e.g. the National
// Film Registry preserves home movies, student films, and raw footage
// collections (0-3 TMDb votes) alongside actual narrative features, and no
// other source in the pool corroborates them as something people have
// actually seen. Scoped to a single source and requiring it be the movie's
// *only* source, so a genuinely popular or multi-list-corroborated movie
// that happens to have a low voteCount is never touched — only entries
// nothing else in the pool backs up.
//
// Usage: node scripts/pruneUncorroboratedLowVoteMovies.js <sourceId> <maxVoteCount>
// e.g.:  node scripts/pruneUncorroboratedLowVoteMovies.js national-film-registry 10
function main() {
  const [sourceId, maxVoteCountArg] = process.argv.slice(2)
  const maxVoteCount = Number(maxVoteCountArg)
  if (!sourceId || !Number.isFinite(maxVoteCount)) {
    console.error('Usage: node scripts/pruneUncorroboratedLowVoteMovies.js <sourceId> <maxVoteCount>')
    process.exit(1)
  }
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`${OUTPUT_FILE} not found.`)
    process.exit(1)
  }

  const pool = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'))
  const toDrop = pool.filter(
    (m) =>
      (m.sources || []).length === 1 &&
      (m.sources || [])[0] === sourceId &&
      (m.voteCount ?? 0) < maxVoteCount,
  )
  const dropIds = new Set(toDrop.map((m) => m.tmdbId))
  const kept = pool.filter((m) => !dropIds.has(m.tmdbId))

  console.log(`Dropping ${toDrop.length} movies (sources === ["${sourceId}"], voteCount < ${maxVoteCount}):`)
  toDrop.forEach((m) => console.log(`  ${m.title} (${m.year}) — ${m.voteCount ?? 0} votes`))

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(kept, null, 2))
  console.log(`Wrote ${kept.length} movies to ${OUTPUT_FILE} (was ${pool.length}).`)
}

main()
