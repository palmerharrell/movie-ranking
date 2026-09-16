import { useEffect, useRef, useState } from 'react'

// Sorts by eloRating descending; ties broken alphabetically. Mirrors
// LeftPanel's sortMovies — by the time this screen shows, every movie in
// scope has timesRanked >= 1, so there's no "unranked" tier to special-case.
function sortMovies(movies) {
  return [...movies].sort((a, b) => {
    if (a.eloRating !== b.eloRating) return b.eloRating - a.eloRating
    return a.title.localeCompare(b.title)
  })
}

// Exported for SharedRankingView.jsx (#220), the public standalone view for
// a shared link — reuses this tile so a shared Top 10 looks like the same
// tile the owner saw, without pulling in the rest of this authenticated
// screen (mid/rest/outside tiers, Continue/Share footer, etc).
export function TopTenTile({ movie, rank }) {
  const topClass = rank <= 3 ? `top-${rank}` : ''
  return (
    <li className={`results-top-tile flex flex-col ${topClass}`}>
      <div className="poster-placeholder results-top-tile-poster w-full overflow-hidden rounded-[8px] bg-cover">
        {movie.posterUrl && (
          <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
        )}
        <span className="results-top-tile-rank font-mono">{rank}</span>
      </div>
      <p className="mt-2 truncate text-sm font-semibold" style={{ color: 'var(--text-high)' }}>
        {movie.title}
      </p>
      <p className="font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>
        {movie.year}
      </p>
    </li>
  )
}

function MidTile({ movie, rank }) {
  return (
    <li className="results-mid-tile flex flex-col">
      <div className="poster-placeholder results-mid-tile-poster w-full overflow-hidden rounded-[6px] bg-cover">
        {movie.posterUrl && (
          <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
        )}
        <span className="results-mid-tile-rank font-mono">{rank}</span>
      </div>
      <p className="mt-1.5 truncate text-xs font-medium" style={{ color: 'var(--text-high)' }}>
        {movie.title}
      </p>
      <p className="font-mono text-[10px]" style={{ color: 'var(--text-low)' }}>
        {movie.year}
      </p>
    </li>
  )
}

function RestRow({ movie, rank }) {
  return (
    <li className="results-rest-row flex items-center gap-3 px-2 py-2">
      <span className="w-[30px] shrink-0 text-right font-mono text-sm" style={{ color: 'var(--text-low)' }}>
        {rank}
      </span>
      <div className="poster-placeholder h-[96px] w-[64px] shrink-0 overflow-hidden rounded-[6px] bg-cover">
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

function OutsideRow({ movie, rank }) {
  return (
    <li className="results-outside-row flex items-baseline gap-3 px-2 py-1">
      <span className="w-[30px] shrink-0 text-right font-mono text-xs" style={{ color: 'var(--text-low)' }}>
        {rank}
      </span>
      <p className="truncate text-sm" style={{ color: 'var(--text-mid)' }}>{movie.title}</p>
      <span className="font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>{movie.year}</span>
    </li>
  )
}

// `scopeLabel` (e.g. "CHRISTOPHER NOLAN MOVIES") describes what pool this
// ranking covers — shown alongside the "TOP N" heading; a saved ranking's
// own custom name is only shown in the Load Ranking picker list, not
// repeated here. `onShare`, when given, shows a "Share" button — it's an
// async () => Promise<void> that resolves and copies the share link itself
// (App.jsx saves lazily on first Share if nothing's been saved yet) —
// ResultsScreen only owns the click-feedback state, not how the link is
// produced. This screen used to also support a read-only saved-snapshot
// view for LoadRankingView (#107, via an `onBack`/`readOnly` pair), but
// #379 replaced that with importing the snapshot into local state and
// showing this same screen live instead — every render of it now has
// `onRefine`/`onSave`/`onStartOver` available.
export function ResultsScreen({ movies, onDismiss, scopeLabel, onShare, onRefine, onSave, onStartOver }) {
  const [shareState, setShareState] = useState('idle') // idle | pending | copied | error
  const sorted = sortMovies(movies)
  const topTen = sorted.slice(0, 10)
  const elevenToTwentyFive = sorted.slice(10, 25)
  const restOfTopHundred = sorted.slice(25, 100)
  const outsideTopHundred = sorted.slice(100)

  const scrollRef = useRef(null)
  const midRef = useRef(null)
  const restRef = useRef(null)
  const outsideRef = useRef(null)
  const [heading, setHeading] = useState('10')

  // As the user scrolls through the rankings, the floating "TOP N" heading
  // tracks which tier is currently at the top of the scroll area, then
  // disappears once they scroll past the Top 100 into the unranked-below list.
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    function handleScroll() {
      const containerTop = container.getBoundingClientRect().top
      const midTop = midRef.current?.getBoundingClientRect().top
      const restTop = restRef.current?.getBoundingClientRect().top
      const outsideTop = outsideRef.current?.getBoundingClientRect().top

      let next = '10'
      if (midTop !== undefined && midTop <= containerTop + 40) next = '25'
      if (restTop !== undefined && restTop <= containerTop + 40) next = '100'
      if (outsideTop !== undefined && outsideTop <= containerTop + 40) next = null
      setHeading(next)
    }

    handleScroll()
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  async function handleShareClick() {
    setShareState('pending')
    try {
      await onShare()
      setShareState('copied')
    } catch {
      setShareState('error')
    } finally {
      setTimeout(() => setShareState('idle'), 2000)
    }
  }

  const shareLabel =
    shareState === 'copied' ? 'Link Copied!' : shareState === 'error' ? "Couldn't Copy" : 'Share'

  return (
    <div className="modal-overlay results-overlay">
      <div className="modal-card modal-card-wide results-card flex flex-col">
        <button
          type="button"
          onClick={onDismiss}
          className="results-close-button"
          aria-label="Close"
        >
          ×
        </button>
        {heading && (
          <div className="results-top-ten-row shrink-0">
            <p className="results-top-ten-heading">
              <span>TOP</span> <span>{heading}</span>
            </p>
            {scopeLabel && <p className="results-scope-label">{scopeLabel}</p>}
          </div>
        )}

        <div ref={scrollRef} className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="results-top-ten-panel">
            <ol className="results-top-ten grid grid-cols-2 gap-3 sm:grid-cols-5">
              {topTen.map((movie, index) => (
                <TopTenTile key={movie.id} movie={movie} rank={index + 1} />
              ))}
            </ol>
          </div>

          {elevenToTwentyFive.length > 0 && (
            <div ref={midRef} className="results-mid-tier-panel mt-5">
              <ol className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                {elevenToTwentyFive.map((movie, index) => (
                  <MidTile key={movie.id} movie={movie} rank={index + 11} />
                ))}
              </ol>
            </div>
          )}

          {restOfTopHundred.length > 0 && (
            <div ref={restRef} className="results-rest-panel mt-5">
              <ol className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
                {restOfTopHundred.map((movie, index) => (
                  <RestRow key={movie.id} movie={movie} rank={index + 26} />
                ))}
              </ol>
            </div>
          )}

          {outsideTopHundred.length > 0 && (
            <ol
              ref={outsideRef}
              className="mt-4 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {outsideTopHundred.map((movie, index) => (
                <OutsideRow key={movie.id} movie={movie} rank={index + 101} />
              ))}
            </ol>
          )}
        </div>

        <div className="results-actions mt-4 flex flex-wrap shrink-0 items-center justify-end gap-2">
          {onShare && (
            <button
              type="button"
              onClick={handleShareClick}
              disabled={shareState === 'pending'}
              className="modal-button-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {shareLabel}
            </button>
          )}
          <button type="button" onClick={onRefine} className="modal-button-secondary text-sm">
            Refine Ranking
          </button>
          <button type="button" onClick={onSave} className="modal-button-secondary text-sm">
            Save
          </button>
          <button type="button" onClick={onStartOver} className="modal-button-danger text-sm">
            Start Over
          </button>
        </div>
      </div>
    </div>
  )
}
