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
      className="movie-tile flex cursor-grab select-none items-center gap-3 rounded-lg border px-3.5 py-2.5 active:cursor-grabbing"
    >
      <span className={`movie-tile-rank w-6 shrink-0 text-center text-lg font-bold ${rank === 1 ? 'top-1' : ''}`}>
        {rank}
      </span>
      <div className="poster-placeholder h-16 w-11 shrink-0 overflow-hidden rounded-[5px] bg-cover">
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
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onSkip(movie.id)
        }}
        disabled={disabled}
        className="skip-button shrink-0 text-[11px] font-medium uppercase disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Haven't seen ${movie.title} — remove from this pack`}
      >
        Haven&apos;t Seen
      </button>
      <div className="flex shrink-0 flex-col gap-[3px]">
        <span className="drag-handle-bar h-[2px] w-4 rounded-full" />
        <span className="drag-handle-bar h-[2px] w-4 rounded-full" />
        <span className="drag-handle-bar h-[2px] w-4 rounded-full" />
      </div>
    </div>
  )
}
