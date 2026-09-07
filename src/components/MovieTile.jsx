import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function MovieTile({ movie, rank, onSkip, disabled, onOpenDetail }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: movie.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const cast = movie.cast?.slice(0, 3) ?? []
  const isUnranked = (movie.timesRanked || 0) === 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpenDetail(movie)}
      className={`movie-tile flex cursor-grab touch-none select-none items-center gap-2 rounded-lg border px-2.5 py-2.5 active:cursor-grabbing sm:gap-3 sm:px-3.5 ${isUnranked ? 'movie-tile--unranked' : ''}`}
      aria-label={`Drag to reorder ${movie.title}, or click to see full details${isUnranked ? ' (not yet ranked)' : ''}`}
    >
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <span className={`movie-tile-rank text-center text-lg font-bold ${rank === 1 ? 'top-1' : ''}`}>
          {rank}
        </span>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            event.currentTarget.blur()
            // Deferred a tick (#250): on mobile touchscreens, removing this
            // tile synchronously (shrinking the pack and shifting the tiles
            // below it up) still lands the browser's own post-tap focus
            // handling on whatever tile's Skip button now occupies this
            // button's former position, even though blur() above already
            // cleared focus from this one. Letting the tap's own focus
            // handling finish first, before the removal that reflows the
            // list, keeps that from re-targeting a still-present button.
            setTimeout(() => onSkip(movie.id), 0)
          }}
          disabled={disabled}
          className="skip-button flex h-9 w-9 items-center justify-center text-base leading-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-6 sm:w-6 sm:text-sm"
          aria-label={`Haven't seen ${movie.title} — remove from this pack`}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <div className="poster-placeholder h-16 w-11 shrink-0 overflow-hidden rounded-[5px] bg-cover sm:h-20 sm:w-14">
        {movie.posterUrl && (
          <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
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
    </div>
  )
}
