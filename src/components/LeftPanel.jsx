// Sorts by eloRating descending; movies never yet ranked (still at the
// default 1000) are grouped alphabetically among themselves, per CLAUDE.md.
function sortMovies(movies) {
  return [...movies].sort((a, b) => {
    if (a.eloRating !== b.eloRating) return b.eloRating - a.eloRating
    return a.title.localeCompare(b.title)
  })
}

export function LeftPanel({ movies }) {
  const sorted = sortMovies(movies)

  return (
    <div className="h-full overflow-y-auto">
      <ol className="divide-y divide-gray-200">
        {sorted.map((movie, index) => (
          <li key={movie.id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-6 shrink-0 text-right text-sm text-gray-400">
              {index + 1}
            </span>
            <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-gray-200">
              {movie.posterUrl && (
                <img
                  src={movie.posterUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{movie.title}</p>
              <p className="text-xs text-gray-500">{movie.year}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
