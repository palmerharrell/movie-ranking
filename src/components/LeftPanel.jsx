// Sorts by eloRating descending; movies never yet ranked (still at the
// default 1000) are grouped alphabetically among themselves, per CLAUDE.md.
function sortMovies(movies) {
  return [...movies].sort((a, b) => {
    if (a.eloRating !== b.eloRating) return b.eloRating - a.eloRating
    return a.title.localeCompare(b.title)
  })
}

function StandingsRow({ movie, rank }) {
  const topClass = rank <= 3 ? `top-${rank}` : ''
  const rankedClass = movie.timesRanked >= 1 ? 'ranked' : ''

  return (
    <li className={`standings-row flex items-center gap-3 px-2 py-1.5 ${topClass} ${rankedClass}`}>
      <span className="standings-rank w-[26px] shrink-0 text-right text-sm">{rank}</span>
      <div className="poster-placeholder h-[56px] w-[38px] shrink-0 overflow-hidden rounded-[4px] bg-cover">
        {movie.posterUrl && (
          <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium" style={{ color: 'var(--text-high)' }}>
          {movie.title}
        </p>
        <p className="font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>
          {movie.year}
        </p>
      </div>
    </li>
  )
}

export function LeftPanel({ movies }) {
  const sorted = sortMovies(movies)
  const rankedCount = movies.filter((m) => m.timesRanked >= 1).length

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex shrink-0 items-baseline justify-between">
        <span className="standings-label text-xs font-medium uppercase">The Standings</span>
        <span className="font-mono text-xs" style={{ color: 'var(--text-low)' }}>
          {rankedCount}/{sorted.length} ranked
        </span>
      </div>
      <ol className="standings-list flex min-h-0 flex-1 flex-col overflow-y-auto pr-[15px]">
        {sorted.map((movie, index) => (
          <StandingsRow key={movie.id} movie={movie} rank={index + 1} />
        ))}
      </ol>
    </div>
  )
}
