import { useEffect, useState } from 'react'
import * as api from '../lib/api.js'
import { subsetLabel } from '../lib/genreSubsets.js'

// "Continue" from the Start screen (#361) — unlike LoadRankingView (which
// only lists saves matching the *currently active* subset+pg13, for
// read-only viewing), this lists every saved ranking across every
// subset/pg13 combination, since there's no active subset yet at this point
// in the flow. Picking one hands off to App's handleContinueRanking, which
// imports that snapshot's ratings into local state and switches into it for
// live re-ranking (a "Refine Ranking" pass), not a read-only view. Legacy
// snapshots saved before #186 added the `subset` column are excluded — with
// no recorded subset there's no pool to resume into.
export function ContinueRankingScreen({ onSelect, onBack }) {
  const [rankings, setRankings] = useState(null)
  const [error, setError] = useState(null)
  const [loadingId, setLoadingId] = useState(null)

  useEffect(() => {
    api.getSavedRankings().then(setRankings).catch((err) => setError(err.message))
  }, [])

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

  const continuable = rankings ? rankings.filter((r) => r.subset) : null

  return (
    <div className="start-screen-body flex min-h-0 flex-1 flex-col overflow-hidden px-4 md:px-8">
      <div className="flex shrink-0 items-center gap-3 py-4">
        <button type="button" onClick={onBack} className="modal-back" aria-label="Back">
          ← Back
        </button>
        <h2 className="new-ranking-title">Continue</h2>
      </div>

      {error && <p className="mx-auto w-full max-w-md text-sm text-red-400">{error}</p>}

      {!continuable && !error && (
        <p className="mx-auto w-full max-w-md text-sm" style={{ color: 'var(--text-low)' }}>
          Loading…
        </p>
      )}

      {continuable && continuable.length === 0 && !error && (
        <p className="mx-auto w-full max-w-md text-sm" style={{ color: 'var(--text-low)' }}>
          No saved rankings yet.
        </p>
      )}

      {continuable && continuable.length > 0 && (
        <ul className="continue-ranking-list mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-6">
          {continuable.map((ranking) => (
            <li key={ranking.id}>
              <button
                type="button"
                onClick={() => handleSelect(ranking)}
                disabled={loadingId !== null}
                className="saved-ranking-row flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium" style={{ color: 'var(--text-high)' }}>
                    {ranking.name}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>
                    {subsetLabel(ranking.subset)}
                    {ranking.pg13 ? ' · PG-13 & Under' : ''} · {ranking.movieCount} movies
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>
                  {loadingId === ranking.id ? '…' : new Date(ranking.createdAt).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
