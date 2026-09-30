import { GENRE_SUBSETS } from '../lib/genreSubsets.js'

const CURATED_SUBSETS = [{ id: 'popular', label: 'Popular' }]
const FAMILY_SUBSET = { id: 'family', label: 'Family' }

// Same grouping SubsetPicker.jsx's dropdown uses (Curated Lists / Genres /
// Directors / Not Recommended), just laid out as a full-screen list rather
// than a small dropdown — this is "Start a New Ranking" from the Start
// screen (#361): picking any option here starts ranking that subset, exactly
// like picking it from the banner's own subset pill later would.

function SubsetRow({ id, label, onPick }) {
  return (
    <button type="button" onClick={() => onPick(id)} className="new-ranking-row subset-dropdown-item">
      {label}
    </button>
  )
}

export function NewRankingScreen({ allMoviesCount, directorSubsets, onPick, onBack }) {
  return (
    <div className="start-screen-body flex min-h-0 flex-1 flex-col overflow-hidden px-4 md:px-8">
      <div className="flex shrink-0 items-center gap-3 py-4">
        <button type="button" onClick={onBack} className="modal-back" aria-label="Back">
          ← Back
        </button>
        <h2 className="new-ranking-title">Start a New Ranking</h2>
      </div>
      <div className="new-ranking-list mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-6">
        <div className="subset-dropdown-group-label">Curated Lists</div>
        {CURATED_SUBSETS.map((s) => (
          <SubsetRow key={s.id} id={s.id} label={s.label} onPick={onPick} />
        ))}
        <div className="subset-dropdown-group-label">Genres</div>
        <SubsetRow id={FAMILY_SUBSET.id} label={FAMILY_SUBSET.label} onPick={onPick} />
        {GENRE_SUBSETS.map((s) => (
          <SubsetRow key={s.id} id={s.id} label={s.label} onPick={onPick} />
        ))}
        {directorSubsets.length > 0 && (
          <>
            <div className="subset-dropdown-group-label">Directors</div>
            {directorSubsets.map((s) => (
              <SubsetRow key={s.id} id={s.id} label={s.label} onPick={onPick} />
            ))}
          </>
        )}
        <div className="subset-dropdown-group-label">Not Recommended</div>
        <SubsetRow
          id="all"
          label={`All${allMoviesCount != null ? ` (${allMoviesCount})` : ''}`}
          onPick={onPick}
        />
      </div>
    </div>
  )
}
