import { formatPackLabel } from '../lib/labelWording.js'

function PackChoiceCard({ pack, disabled, onChoose }) {
  // Posters fan across a fixed strip so every card ends at the same x,
  // regardless of pack size — a 5-film pack overlaps tightly, a 2-film pack
  // barely overlaps (see design_handoff_movie_ranker/README.md's Pack
  // choice formula). Expressed as a percentage of the poster's own width
  // rather than a JS pixel computation, since the poster itself is already
  // sized off the tier's aspect-ratio box.
  const n = pack.movies.length
  const overlapPct = n > 1 ? 42 / (n - 1 + 1) : 0

  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={disabled}
      style={{ padding: 'var(--tile-pad)' }}
      className="pack-choice-card flex min-w-0 items-center gap-3.5 rounded-lg text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="pack-choice-poster-stack flex shrink-0">
        {pack.movies.map((movie, index) => (
          <div
            key={movie.id}
            className="poster-placeholder h-14 w-9 shrink-0 overflow-hidden bg-cover"
            style={index === 0 ? undefined : { marginLeft: `${-overlapPct}%` }}
          >
            {movie.posterUrl && (
              <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        ))}
      </div>
      <span className="pack-choice-label min-w-0 flex-1 truncate font-semibold" style={{ color: 'var(--text-high)' }}>
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
      <div className="pack-choice-grid grid min-h-0 flex-1 gap-3">
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
