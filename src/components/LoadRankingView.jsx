import { useEffect, useState } from 'react'
import * as api from '../lib/api.js'

function SnapshotRow({ movie, rank }) {
  return (
    <li className="flex items-center gap-3 px-2 py-1.5">
      <span className="w-[26px] shrink-0 text-right text-sm" style={{ color: 'var(--text-low)' }}>
        {rank}
      </span>
      <div className="poster-placeholder h-[48px] w-[32px] shrink-0 overflow-hidden rounded-[4px] bg-cover">
        {movie.posterUrl && (
          <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" style={{ color: 'var(--text-high)' }}>
          {movie.title}
        </p>
        <p className="font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>{movie.year}</p>
      </div>
    </li>
  )
}

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

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-card-wide">
        <div className="flex items-center justify-between">
          <p className="modal-eyebrow text-[11px] font-medium uppercase">
            {selected ? selected.name : 'Saved Rankings'}
          </p>
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

        {rankings && !selected && (
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

        {selected && (
          <>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="modal-back mt-3 text-xs"
            >
              ← Back to list
            </button>
            <ol className="mt-3 flex max-h-[50vh] flex-col overflow-y-auto pr-2">
              {selected.movies.map((movie, index) => (
                <SnapshotRow key={movie.id} movie={movie} rank={index + 1} />
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}
