import { formatPackLabel } from '../lib/labelWording.js'

function PackChoiceCard({ pack, disabled, onChoose }) {
  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={disabled}
      className="pack-choice-card flex min-w-0 flex-col items-center gap-3 rounded-lg p-4 text-center disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="pack-choice-poster-stack flex shrink-0 -space-x-2.5">
        {pack.movies.map((movie) => (
          <div
            key={movie.id}
            className="poster-placeholder h-14 w-9 shrink-0 overflow-hidden rounded-[3px] bg-cover"
          >
            {movie.posterUrl && (
              <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        ))}
      </div>
      <span
        className="pack-choice-label w-full truncate text-[15px] font-semibold"
        style={{ color: 'var(--text-high)' }}
      >
        {formatPackLabel(pack.label)}
      </span>
    </button>
  )
}

// Occasionally (#297), instead of the next pack simply appearing, three
// candidate packs are offered and the user picks which one becomes active —
// replacing the old pre-generated "Up Next" queue. `options` never includes
// Head to Head/Top 10 Tough Choice (see generateTurn in
// categoryGenerator.js) — always 3 normal 5-tile packs (attribute-based or
// Random Five), so picking one always leads into the usual RightPanel
// drag-and-rank flow. No per-movie interaction here in v1 — just picking a
// whole pack, so no drag context and no movie-detail affordance.
export function PackChoiceScreen({ options, onChoose, disabled }) {
  return (
    <div className="pack-card">
      <h2 className="pack-category-label mb-3">Choose Your Next Pack</h2>
      <div className="pack-choice-grid grid gap-3">
        {options.map((pack, index) => (
          <PackChoiceCard
            key={pack.movies.map((m) => m.id).join('-')}
            pack={pack}
            disabled={disabled}
            onChoose={() => onChoose(index)}
          />
        ))}
      </div>
    </div>
  )
}
