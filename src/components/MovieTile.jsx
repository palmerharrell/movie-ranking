import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function MovieTile({ movie, rank, onSkip, disabled, frozen, onOpenDetail }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: movie.id, disabled: frozen })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const cast = movie.cast?.slice(0, 3) ?? []
  const isAlreadyRanked = (movie.timesRanked || 0) > 0

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...(frozen ? {} : listeners)}
      onClick={frozen ? undefined : () => onOpenDetail(movie)}
      className={`movie-tile flex touch-none select-none items-center gap-2.5 overflow-hidden rounded-lg border ${frozen ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${isAlreadyRanked ? 'movie-tile--already-ranked' : ''}`}
      style={{ ...style, padding: 'var(--tile-pad)' }}
      aria-label={
        frozen
          ? `${movie.title}, awaiting skip confirmation`
          : `Drag to reorder ${movie.title}, or click to see full details${isAlreadyRanked ? ' (already ranked)' : ''}`
      }
    >
      <div className="movie-tile-rank-col">
        <span className={`movie-tile-rank font-bold ${rank === 1 ? 'top-1' : ''}`}>{rank}</span>
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
          className="skip-button flex h-11 w-11 items-center justify-center text-base leading-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Haven't seen ${movie.title} — remove from this pack`}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <div className="poster-placeholder pack-tile-poster">
        {movie.posterUrl && (
          <img src={movie.posterUrl} alt="" className="h-full w-full object-contain" />
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
