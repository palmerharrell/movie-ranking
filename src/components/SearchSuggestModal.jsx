import { useEffect, useState } from 'react'
import * as api from '../lib/api.js'

// Search & Suggest (#243): search the entire pool (not just the active
// subset — mirrors SkippedView's own unscoped fetch, since a movie someone
// is looking for could belong to any subset) by title as they type, and —
// only on an explicit click, not on every keystroke, to keep this to one
// TMDb call per actual search rather than one per character — offer a live
// TMDb lookup to add whatever's missing. Adding a candidate is a single
// click (the "matching TMDb data" confirmation is the click itself,
// backed by the poster/year shown for that candidate), enriched and
// persisted immediately server-side (see server/suggestionService.js) —
// no further approval step.
export function SearchSuggestModal({ onClose, onAdded, onOpenDetail }) {
  const [query, setQuery] = useState('')
  const [pool, setPool] = useState(null)
  const [poolError, setPoolError] = useState(null)
  const [candidates, setCandidates] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [addingId, setAddingId] = useState(null)
  const [addedIds, setAddedIds] = useState(() => new Set())
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    api.getMovies().then(setPool).catch((err) => setPoolError(err.message))
  }, [])

  const trimmedQuery = query.trim()
  const poolMatches = pool
    ? pool
        .filter((m) => m.title.toLowerCase().includes(trimmedQuery.toLowerCase()))
        .slice(0, 25)
    : []

  async function handleSearchTmdb() {
    if (!trimmedQuery) return
    setSearching(true)
    setSearchError(null)
    setCandidates(null)
    try {
      setCandidates(await api.searchTmdbForSuggestion(trimmedQuery))
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function handleAdd(tmdbId) {
    setAddingId(tmdbId)
    setAddError(null)
    try {
      const movie = await api.addSuggestedMovie(tmdbId)
      setAddedIds((prev) => new Set(prev).add(tmdbId))
      setPool((prev) => (prev ? [...prev, movie] : prev))
      onAdded()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-card-wide">
        <div className="flex items-center justify-between">
          <p className="modal-eyebrow text-[11px] font-medium uppercase">Search &amp; Suggest</p>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            ×
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCandidates(null)
            setSearchError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearchTmdb()
          }}
          placeholder="Search by title…"
          className="modal-input mt-3"
          autoFocus
        />

        {poolError && <p className="mt-3 text-sm text-red-400">{poolError}</p>}

        {trimmedQuery && (
          <>
            <p className="mt-4 text-xs font-medium uppercase" style={{ color: 'var(--text-low)' }}>
              In Your Pool
            </p>
            {pool && poolMatches.length === 0 && (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-low)' }}>
                No matches.
              </p>
            )}
            {poolMatches.length > 0 && (
              <ul className="rankings-list mt-2 flex max-h-[30vh] flex-col overflow-y-auto pr-[4px]">
                {poolMatches.map((movie) => (
                  <li
                    key={movie.id}
                    onClick={() => onOpenDetail(movie)}
                    className="rankings-row flex cursor-pointer items-center gap-3 px-2"
                  >
                    <div className="poster-placeholder rankings-poster shrink-0 overflow-hidden rounded-[4px] bg-cover">
                      {movie.posterUrl && (
                        <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium" style={{ color: 'var(--text-high)' }}>
                        {movie.title}
                      </p>
                      <p className="font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>
                        {movie.year}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs font-medium uppercase" style={{ color: 'var(--text-low)' }}>
                Can&rsquo;t find it? Search TMDb
              </p>
              <button
                type="button"
                onClick={handleSearchTmdb}
                disabled={searching}
                className="modal-button-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searching ? 'Searching…' : `Search TMDb for "${trimmedQuery}"`}
              </button>
            </div>

            {searchError && <p className="mt-2 text-sm text-red-400">{searchError}</p>}
            {addError && <p className="mt-2 text-sm text-red-400">{addError}</p>}

            {candidates && candidates.length === 0 && (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-low)' }}>
                TMDb has no matches for "{trimmedQuery}".
              </p>
            )}

            {candidates && candidates.length > 0 && (
              <ul className="mt-2 flex flex-col gap-2">
                {candidates.map((candidate) => {
                  const added = addedIds.has(candidate.tmdbId)
                  return (
                    <li
                      key={candidate.tmdbId}
                      className="rankings-row flex items-center gap-3 px-2"
                    >
                      <div className="poster-placeholder rankings-poster shrink-0 overflow-hidden rounded-[4px] bg-cover">
                        {candidate.posterUrl && (
                          <img src={candidate.posterUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium" style={{ color: 'var(--text-high)' }}>
                          {candidate.title}
                        </p>
                        <p className="font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>
                          {candidate.year ?? 'Year unknown'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAdd(candidate.tmdbId)}
                        disabled={added || addingId === candidate.tmdbId}
                        className="saved-ranking-row flex min-h-11 shrink-0 items-center justify-center rounded-lg border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {added ? 'Added ✓' : addingId === candidate.tmdbId ? 'Adding…' : 'Add to Pool'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
