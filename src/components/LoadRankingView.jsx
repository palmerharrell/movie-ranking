import { useEffect, useState } from 'react'
import * as api from '../lib/api.js'
import { subsetLabel } from '../lib/genreSubsets.js'

// Saved rankings are scoped to the subset they were saved from (#186
// follow-up) and to whether the PG-13-and-under toggle (#193) was active, so
// this only ever lists — and lets you load — snapshots that match the
// currently active subset+toggle combination.
//
// #379: picking a snapshot here used to open a read-only view of it
// (`ResultsScreen` with `readOnly`) — a deliberate #107 restriction against
// mutating a historical snapshot. That restriction has been lifted: picking
// one now imports its eloRating into local state and re-ranks it live, the
// same "keep the rating, re-rank fresh" flow `ContinueRankingScreen.jsx`
// already offers from the Start screen (`onSelect` is `App.jsx`'s
// `handleLoadRanking`, which shares the same `api.continueSavedRanking`
// import step `handleContinueRanking` uses). This view's own job shrinks to
// just listing candidates and handing the pick off — the interactive
// Results screen it lands on lives in `App.jsx`, not here.
export function LoadRankingView({ subset, pg13, onSelect, onClose }) {
  const [rankings, setRankings] = useState(null)
  const [error, setError] = useState(null)
  const [loadingId, setLoadingId] = useState(null)
  const label = pg13 ? `${subsetLabel(subset)} (PG-13 & Under)` : subsetLabel(subset)

  useEffect(() => {
    api.getSavedRankings(subset, pg13).then(setRankings).catch((err) => setError(err.message))
  }, [subset, pg13])

  async function handleSelect(ranking) {
    setError(null)
    setLoadingId(ranking.id)
    try {
      await onSelect(ranking)
    } catch (err) {
      setError(err.message)
      setLoadingId(null)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-card-wide">
        <div className="flex items-center justify-between">
          <p className="modal-eyebrow text-[11px] font-medium uppercase">Load {label} Ranking</p>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            ×
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        {!rankings && !error && (
          <p className="mt-3 text-sm" style={{ color: 'var(--text-low)' }}>
            Loading…
          </p>
        )}

        {rankings && (
          <>
            {rankings.length === 0 ? (
              <p className="mt-3 text-sm" style={{ color: 'var(--text-low)' }}>
                No saved {label} rankings yet.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {rankings.map((ranking) => (
                  <li key={ranking.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(ranking)}
                      disabled={loadingId !== null}
                      className="saved-ranking-row flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="text-sm font-medium" style={{ color: 'var(--text-high)' }}>
                        {ranking.name}
                        <span className="ml-2 font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>
                          {ranking.movieCount} movies
                        </span>
                      </span>
                      <span className="font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>
                        {loadingId === ranking.id ? '…' : new Date(ranking.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
