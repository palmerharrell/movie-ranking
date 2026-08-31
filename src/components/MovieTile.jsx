import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function MovieTile({ movie, rank, onSkip, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: movie.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const cast = movie.cast?.slice(0, 3) ?? []

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="movie-tile flex cursor-grab touch-none select-none items-center gap-2 rounded-lg border px-2.5 py-2.5 active:cursor-grabbing sm:gap-3 sm:px-3.5"
      aria-label={`Drag to reorder ${movie.title}`}
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
            onSkip(movie.id)
          }}
          disabled={disabled}
          className="skip-button flex h-6 w-6 items-center justify-center text-sm leading-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Haven't seen ${movie.title} — remove from this pack`}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <div className="poster-placeholder h-14 w-9 shrink-0 overflow-hidden rounded-[5px] bg-cover sm:h-16 sm:w-11">
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
