import { useEffect, useState } from 'react'
import * as api from '../lib/api.js'

// "Skipped" view (#137): browse every movie marked "haven't seen" in this
// browser (#136's persistent skip), with a per-movie "un-skip" and a
// "Clear all" action, since the in-pack "undo" (onUndoSkip in App.jsx) only
// works while the pack that skip happened in is still active — once it
// resolves, this is the only way to reverse it. Reuses the Standings list's
// row markup/classes and the Load Ranking modal's overlay/card classes
// rather than inventing new patterns.
//
// Skip state isn't scoped to a subset, so this fetches the unfiltered pool
// itself (api.getSkippedMovies) rather than relying on App.jsx's
// subset-filtered `movies` — a movie skipped under one subset must still
// show up here (and be reachable via "Clear all") after switching subsets.
//
// Rendered by App.jsx as the content of an always-mounted slide-out drawer
// (#269, mirroring the Standings drawer's own always-mounted `aside` so the
// slide transition has something to animate rather than popping in/out) —
// `open` only toggles when the drawer opens/closes, so the fetch below is
// keyed on it re-running each time the drawer opens rather than once on
// first mount, keeping the list fresh if a skip happened elsewhere while it
// was closed.
export function SkippedView({ open, onClose, onChange, onOpenDetail }) {
  const [skipped, setSkipped] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    api.getSkippedMovies().then(setSkipped).catch((err) => setError(err.message))
  }, [open])

  function handleUnskip(movieId) {
    api.unmarkSkipped(movieId)
    setSkipped((prev) => prev.filter((m) => m.id !== movieId))
    onChange()
  }

  function handleClearAll() {
    api.unmarkAllSkipped(skipped.map((m) => m.id))
    setSkipped([])
    onChange()
  }

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ padding: '22px 8px 22px 22px' }}>
      <div className="flex items-center justify-between pr-[14px]">
        <p className="modal-eyebrow text-[11px] font-medium uppercase">Skipped Movies</p>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ×
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm" style={{ color: 'var(--text-low)' }}>
          {error}
        </p>
      )}

      {skipped && skipped.length > 0 && (
        <button
          type="button"
          onClick={handleClearAll}
          className="standings-reset-button mt-3 shrink-0 self-start text-xs font-medium uppercase"
        >
          Clear All
        </button>
      )}

      {skipped && skipped.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--text-low)' }}>
          No skipped movies — anything you mark "Haven't Seen" while ranking shows up here.
        </p>
      ) : (
        skipped && (
          <ul className="standings-list mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto pr-[15px]">
            {skipped.map((movie) => (
              <li
                key={movie.id}
                onClick={() => onOpenDetail(movie)}
                className="standings-row flex cursor-pointer items-center gap-3 px-2 py-1.5"
              >
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
                  onClick={(event) => {
                    event.stopPropagation()
                    handleUnskip(movie.id)
                  }}
                  className="saved-ranking-row shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium"
                >
                  Un-skip
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}
