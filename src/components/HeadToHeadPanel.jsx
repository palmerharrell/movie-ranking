import { PackLoadingOverlay } from './PackLoadingOverlay.jsx'
import { applyThemeWording } from '../lib/labelWording.js'

function HeadToHeadCard({ movie, onPick, disabled }) {
  const cast = movie.cast?.slice(0, 3) ?? []

  return (
    <button
      type="button"
      onClick={() => onPick(movie.id)}
      disabled={disabled}
      className="head-to-head-card flex min-w-0 flex-1 flex-col items-center gap-3 rounded-lg border p-4 text-center disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="poster-placeholder h-44 w-[120px] shrink-0 overflow-hidden rounded-[6px] bg-cover sm:h-56 sm:w-[152px]">
        {movie.posterUrl && (
          <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold" style={{ color: 'var(--text-high)' }}>
          {movie.title}{' '}
          <span className="font-mono text-[12px] font-normal" style={{ color: 'var(--text-low)' }}>
            ({movie.year})
          </span>
        </p>
        {(cast.length > 0 || movie.director) && (
          <div className="movie-tile-credits mt-1 space-y-0.5 text-[11px]">
            {cast.length > 0 && <p className="truncate">Starring: {cast.join(', ')}</p>}
            {movie.director && <p className="truncate">Directed by: {movie.director}</p>}
          </div>
        )}
      </div>
    </button>
  )
}

// A "Head to Head" pack is 2 movies, both already ranked — the user just
// clicks the one they'd rank higher, which submits immediately as a single
// pairwise Elo update (no drag-to-order, no "Rank ->" confirmation step,
// and no "Haven't Seen" skip since both movies are, by construction, ones
// the pool has already seen and ranked).
export function HeadToHeadPanel({ category, onPick, disabled, theme }) {
  const [first, second] = category.movies

  return (
    <div className="pack-card">
      <div className="mb-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="pack-eyebrow text-[11px] font-medium uppercase">Now Showing</p>
          <p className="rank-caption text-[11px] text-right">Click the one you'd rank higher</p>
        </div>
        <h2 className="pack-category-label mt-1">{applyThemeWording(category.label, theme)}</h2>
      </div>
      <div className="flex items-stretch gap-3">
        <HeadToHeadCard movie={first} onPick={onPick} disabled={disabled} />
        <span className="head-to-head-vs shrink-0 self-center text-[13px] font-bold uppercase">
          vs
        </span>
        <HeadToHeadCard movie={second} onPick={onPick} disabled={disabled} />
      </div>
      {disabled && <PackLoadingOverlay />}
    </div>
  )
}
