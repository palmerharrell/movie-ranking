import { useEffect, useState } from 'react'
import * as api from '../lib/api.js'
import { ResultsScreen } from './ResultsScreen.jsx'

export function LoadRankingView({ onClose }) {
  const [rankings, setRankings] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getSavedRankings().then(setRankings).catch((err) => setError(err.message))
  }, [])

  function handleSelect(id) {
    setError(null)
    api.getSavedRanking(id).then(setSelected).catch((err) => setError(err.message))
  }

  // A selected snapshot displays via the same tiered Results screen shown on
  // live completion (#107) — read-only, with a "Back to list" link in place
  // of the Save Ranking footer button.
  if (selected) {
    return (
      <ResultsScreen
        movies={selected.movies}
        title={selected.name}
        onBack={() => setSelected(null)}
        onDismiss={onClose}
        readOnly
      />
    )
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-card-wide">
        <div className="flex items-center justify-between">
          <p className="modal-eyebrow text-[11px] font-medium uppercase">Saved Rankings</p>
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
                No saved rankings yet.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {rankings.map((ranking) => (
                  <li key={ranking.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(ranking.id)}
                      className="saved-ranking-row flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left"
                    >
                      <span className="text-sm font-medium" style={{ color: 'var(--text-high)' }}>
                        {ranking.name}
                        <span className="ml-2 font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>
                          {ranking.movieCount} movies
                        </span>
                      </span>
                      <span className="font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>
                        {new Date(ranking.createdAt).toLocaleDateString()}
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
