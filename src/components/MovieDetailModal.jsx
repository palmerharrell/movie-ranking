// A big detail card for a single movie — poster plus everything the small
// tile/row views have to truncate to fit (full title, full cast list). Opened
// by tapping/clicking a movie in a pack, the standings, or the skipped list
// (#222), and via the head-to-head cards' own info button (#223), since
// those are otherwise the one place a movie's full title never fits.
export function MovieDetailModal({ movie, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
          <div className="poster-placeholder h-[240px] w-[160px] shrink-0 overflow-hidden rounded-[8px] bg-cover">
            {movie.posterUrl && (
              <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="mt-4 min-w-0 sm:ml-5 sm:mt-0">
            <h2
              className="modal-title text-xl font-semibold"
              style={{ color: 'var(--text-high)' }}
            >
              {movie.title}
            </h2>
            <p className="font-mono text-sm" style={{ color: 'var(--text-low)' }}>
              {movie.year}
            </p>
            <div className="mt-3 space-y-1.5 text-sm" style={{ color: 'var(--text-mid)' }}>
              {movie.director && <p>Directed by {movie.director}</p>}
              {movie.cast?.length > 0 && <p>Starring {movie.cast.join(', ')}</p>}
              {movie.genres?.length > 0 && <p>{movie.genres.join(', ')}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
