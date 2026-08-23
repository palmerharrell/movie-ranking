import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function MovieTile({ movie, rank }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: movie.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex cursor-grab select-none items-center gap-3 rounded border border-gray-200 bg-white px-3 py-2 shadow-sm active:cursor-grabbing"
    >
      <span className="w-5 shrink-0 text-center text-sm font-semibold text-gray-400">
        {rank}
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
    </div>
  )
}
