// "Skipped" view (#137): browse every movie marked "haven't seen" in this
// browser (#136's persistent skip), with a per-movie "un-skip" and a
// "Clear all" action, since the in-pack "undo" (onUndoSkip in App.jsx) only
// works while the pack that skip happened in is still active — once it
// resolves, this is the only way to reverse it. Reuses the Standings list's
// row markup/classes and the Load Ranking modal's overlay/card classes
// rather than inventing new patterns.
export function SkippedView({ movies, onUnskip, onClearAll, onClose }) {
  const skipped = movies.filter((m) => m.skipped)

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-card-wide">
        <div className="flex items-center justify-between">
          <p className="modal-eyebrow text-[11px] font-medium uppercase">Skipped Movies</p>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            ×
          </button>
        </div>

        {skipped.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="standings-reset-button mt-3 shrink-0 self-start text-xs font-medium uppercase"
          >
            Clear All
          </button>
        )}

        {skipped.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--text-low)' }}>
            No skipped movies — anything you mark "Haven't Seen" while ranking shows up here.
          </p>
        ) : (
          <ul className="standings-list mt-3 flex max-h-[60vh] flex-col overflow-y-auto pr-[15px]">
            {skipped.map((movie) => (
              <li key={movie.id} className="standings-row flex items-center gap-3 px-2 py-1.5">
                <div className="poster-placeholder h-[56px] w-[38px] shrink-0 overflow-hidden rounded-[4px] bg-cover">
                  {movie.posterUrl && (
                    <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[15px] font-medium"
                    style={{ color: 'var(--text-high)' }}
                  >
                    {movie.title}
                  </p>
                  <p className="font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>
                    {movie.year}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUnskip(movie.id)}
                  className="saved-ranking-row shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium"
                >
                  Un-skip
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
