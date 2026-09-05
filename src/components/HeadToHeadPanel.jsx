import { useEffect, useState } from 'react'
import { PackLoadingOverlay } from './PackLoadingOverlay.jsx'
import { formatPackLabel } from '../lib/labelWording.js'

// How long the winner-slides-to-center / loser-slides-off animation plays
// before the loser is removed from the row (see handlePick below) — must
// match the CSS transition duration on .head-to-head-card so the pack
// doesn't swap out from under the animation.
const SLIDE_DURATION_MS = 350
// How long the winner is then shown alone, grown to fill the freed-up row,
// before the pick is actually submitted and the pack advances (#135).
const HOLD_DURATION_MS = 1600

// `slide` is null (no pick yet), 'winner' (slide toward center, on top),
// 'winner-solo' (loser has been removed — recenter and grow to fill the row),
// or 'loser' (slide further off in its own direction and fade out). `side`
// says which half of the row this card started in, since the direction to
// slide depends on that.
function HeadToHeadCard({ movie, onPick, disabled, slide, side }) {
  const cast = movie.cast?.slice(0, 3) ?? []

  const slideStyle =
    slide === 'winner'
      ? {
          transform: `translateX(${side === 'left' ? '62%' : '-62%'}) scale(1.04)`,
          zIndex: 1,
          opacity: 1,
        }
      : slide === 'winner-solo'
        ? { transform: 'scale(1.12)', zIndex: 1, opacity: 1 }
        : slide === 'loser'
          ? { transform: `translateX(${side === 'left' ? '-120%' : '120%'})`, opacity: 0 }
          : undefined

  return (
    <button
      type="button"
      onClick={() => onPick(movie.id)}
      disabled={disabled}
      style={slideStyle}
      className="head-to-head-card flex min-w-0 flex-1 flex-col items-center gap-3 rounded-lg border p-4 text-center disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="poster-placeholder h-44 w-[120px] shrink-0 overflow-hidden rounded-[6px] bg-cover sm:h-56 sm:w-[152px]">
        {movie.posterUrl && (
          <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="w-full min-w-0">
        <p className="truncate text-[15px] font-semibold" style={{ color: 'var(--text-high)' }}>
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
export function HeadToHeadPanel({ category, onPick, disabled }) {
  const [first, second] = category.movies
  // Identifies this specific pack (not just a movie — the same movie can
  // reappear in the next pack) so each card can be keyed to remount cleanly
  // on a pack swap instead of inheriting the outgoing pack's leftover slide
  // transform and animating out of it.
  const packKey = `${first.id}:${second.id}`
  // Tied to the category it was made for, so a pick from the *previous*
  // pack can never leak into the render of a freshly-promoted one — no
  // stale-state frame for the effect below to race with.
  const [pick, setPick] = useState(null) // { category, winnerId } | null
  const pickedId = pick?.category === category ? pick.winnerId : null
  // 'sliding' during the winner-to-center / loser-off animation, then
  // 'holding' once the loser is removed and the winner grows to fill the row
  // (#135) — only meaningful while pickedId is set.
  const [phase, setPhase] = useState('sliding')

  // Once the real pack swap lands (new category promoted), the pick object
  // is stale by definition (see pickedId above) — clear it so the next pick
  // starts from a clean state instead of holding a dangling reference.
  useEffect(() => {
    if (pick && pick.category !== category) {
      setPick(null)
      setPhase('sliding')
    }
  }, [category, pick])

  function handlePick(winnerId) {
    if (pickedId || disabled) return
    setPick({ category, winnerId })
    setPhase('sliding')
    setTimeout(() => setPhase('holding'), SLIDE_DURATION_MS)
    setTimeout(() => onPick(winnerId), SLIDE_DURATION_MS + HOLD_DURATION_MS)
  }

  function slideFor(movieId) {
    if (!pickedId) return null
    if (movieId !== pickedId) return 'loser'
    return phase === 'holding' ? 'winner-solo' : 'winner'
  }

  return (
    <div className="pack-card">
      <div className="mb-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="pack-eyebrow text-[11px] font-medium uppercase">Now Showing</p>
          <p className="rank-caption text-[11px] text-right">Click the one you'd rank higher</p>
        </div>
        <h2 className="pack-category-label mt-1">{formatPackLabel(category.label)}</h2>
      </div>
      <div className="flex items-stretch gap-3 overflow-hidden">
        {(phase !== 'holding' || first.id === pickedId) && (
          <HeadToHeadCard
            key={`left-${packKey}`}
            movie={first}
            onPick={handlePick}
            disabled={disabled || !!pickedId}
            slide={slideFor(first.id)}
            side="left"
          />
        )}
        {phase !== 'holding' && (
          <span
            className="head-to-head-vs shrink-0 self-center text-[13px] font-bold uppercase transition-opacity duration-200"
            style={pickedId ? { opacity: 0 } : undefined}
          >
            vs
          </span>
        )}
        {(phase !== 'holding' || second.id === pickedId) && (
          <HeadToHeadCard
            key={`right-${packKey}`}
            movie={second}
            onPick={handlePick}
            disabled={disabled || !!pickedId}
            slide={slideFor(second.id)}
            side="right"
          />
        )}
      </div>
      {disabled && <PackLoadingOverlay />}
    </div>
  )
}
