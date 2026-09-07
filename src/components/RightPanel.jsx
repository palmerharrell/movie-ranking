import { useRef } from 'react'
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
  onOpenDetail,
}) {
  // A distance constraint (rather than the default, which activates a drag
  // on pointerdown with zero movement) is required for tiles to be
  // click-to-open-detail (#222) at all — dnd-kit installs a capture-phase
  // click-swallower the instant a drag activates, so with no constraint
  // every tap, including ones with no movement, would silently eat its own
  // click event before onOpenDetail ever saw it.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const tilesListRef = useRef(null)

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = category.movies.findIndex((m) => m.id === active.id)
    const newIndex = category.movies.findIndex((m) => m.id === over.id)
    onReorder(arrayMove(category.movies, oldIndex, newIndex))
  }

  // Moving the tapped Skip button's own `blur()` (see #125) isn't enough on
  // touch: mobile browsers assign focus as part of a click's *default
  // action*, which for a synthesized touch click can run after our onClick
  // handler returns — silently undoing an immediate blur — and then, once
  // the tile is removed from the DOM, the browser falls back to focusing
  // whatever ends up in that same DOM position (another tile's Skip
  // button). Deferring to a macrotask (setTimeout) guarantees this runs
  // after any such native default action, so we can deterministically move
  // focus to a stable, intentional target (the tile list container, not a
  // moving tile) instead of leaving it to the browser's fallback.
  function handleSkip(movieId) {
    onSkip(movieId)
    setTimeout(() => {
      tilesListRef.current?.focus({ preventScroll: true })
    }, 0)
  }

  return (
    <div className="pack-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="pack-category-label">{formatPackLabel(category.label)}</h2>
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
          <div ref={tilesListRef} tabIndex={-1} className="flex flex-col gap-2 outline-none">
            {category.movies.map((movie, index) => (
              <MovieTile
                key={movie.id}
                movie={movie}
                rank={index + 1}
                onSkip={handleSkip}
                disabled={disabled}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {awaitingLastSkipConfirm && category.movies.length === 1 && (
        <div className="last-skip-prompt mt-3 flex flex-col items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
          <p>Skip &ldquo;{category.movies[0].title}&rdquo; too?</p>
          <div className="flex gap-2">
            {/* No is the default (#194): primary styling and autoFocus, since
                declining is the non-destructive choice — it doesn't touch the
                movie's ranking data, unlike Yes. */}
            <button
              type="button"
              onClick={onDeclineSkipLast}
              disabled={disabled}
              autoFocus
              className="modal-button-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              No
            </button>
            <button
              type="button"
              onClick={onConfirmSkipLast}
              disabled={disabled}
              className="modal-button-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Yes
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
