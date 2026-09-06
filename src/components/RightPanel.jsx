import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { MovieTile } from './MovieTile.jsx'
import { PackLoadingOverlay } from './PackLoadingOverlay.jsx'
import { formatPackLabel } from '../lib/labelWording.js'

export function RightPanel({
  category,
  onReorder,
  onSkip,
  skippedMovies,
  onUndoSkip,
  awaitingLastSkipConfirm,
  onConfirmSkipLast,
  onDeclineSkipLast,
  disabled,
}) {
  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = category.movies.findIndex((m) => m.id === active.id)
    const newIndex = category.movies.findIndex((m) => m.id === over.id)
    onReorder(arrayMove(category.movies, oldIndex, newIndex))
  }

  return (
    <div className="pack-card">
      <div className="mb-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="pack-eyebrow text-[11px] font-medium uppercase">Now Showing</p>
          {category.movies.length > 1 && (
            <p className="rank-caption text-[11px] text-right">
              Drag to reorder, click Rank to set order and go to next list
            </p>
          )}
        </div>
        <h2 className="pack-category-label mt-1">{formatPackLabel(category.label)}</h2>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={category.movies.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {category.movies.map((movie, index) => (
              <MovieTile
                key={movie.id}
                movie={movie}
                rank={index + 1}
                onSkip={onSkip}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {awaitingLastSkipConfirm && category.movies.length === 1 && (
        <div className="last-skip-prompt mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm">
          <p>Skip &ldquo;{category.movies[0].title}&rdquo; too?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDeclineSkipLast}
              disabled={disabled}
              className="modal-button-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Not yet
            </button>
            <button
              type="button"
              onClick={onConfirmSkipLast}
              disabled={disabled}
              className="modal-button-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Skip it
            </button>
          </div>
        </div>
      )}
      {skippedMovies.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {skippedMovies.map(({ movie }) => (
            <p key={movie.id} className="undo-skip text-[11px]">
              Removed &ldquo;{movie.title}&rdquo;.{' '}
              <button
                type="button"
                onClick={() => onUndoSkip(movie.id)}
                disabled={disabled}
                className="undo-skip-button font-medium underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                Undo
              </button>
            </p>
          ))}
        </div>
      )}
      {disabled && <PackLoadingOverlay />}
    </div>
  )
}
