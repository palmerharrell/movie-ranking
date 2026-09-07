import { useEffect, useState } from 'react'
import * as api from '../lib/api.js'
import { subsetLabel } from '../lib/genreSubsets.js'
import { TopTenTile } from './ResultsScreen.jsx'

// The public page a shared link (#220) opens to — gated on `?share=<slug>`
// in main.jsx, entirely outside the authenticated app shell (no bearer
// token needed, no pool fetch). Deliberately minimal: just the Top 10, not
// the full tiered Results screen, matching what the public share endpoint
// itself returns.
export function SharedRankingView({ slug }) {
  const [shared, setShared] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getSharedRanking(slug).then(setShared).catch((err) => setError(err.message))
  }, [slug])

  const subtitle = shared?.subset
    ? shared.pg13
      ? `${subsetLabel(shared.subset)} (PG-13 & Under)`
      : subsetLabel(shared.subset)
    : null

  return (
    <div
      data-theme="popular"
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: 'var(--bg-page)' }}
    >
      <div className="modal-card modal-card-wide">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!shared && !error && (
          <p className="text-sm" style={{ color: 'var(--text-low)' }}>
            Loading…
          </p>
        )}
        {shared && (
          <>
            <p className="modal-eyebrow truncate text-[11px] font-medium uppercase">{shared.name}</p>
            {subtitle && (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-low)' }}>
                {subtitle}
              </p>
            )}
            <ol className="results-top-ten mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {shared.movies.map((movie, index) => (
                <TopTenTile key={movie.id} movie={movie} rank={index + 1} />
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}
