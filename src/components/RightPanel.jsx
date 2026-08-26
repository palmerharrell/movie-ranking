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
import { applyThemeWording } from '../lib/labelWording.js'

export function RightPanel({ category, onReorder, onSkip, disabled, theme }) {
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
        <p className="pack-eyebrow text-[11px] font-medium uppercase">Now Showing</p>
        <h2 className="pack-category-label mt-1">{applyThemeWording(category.label, theme)}</h2>
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
    </div>
  )
}
