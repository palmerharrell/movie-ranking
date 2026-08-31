import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Sorts by eloRating descending; ties broken alphabetically. Mirrors
// LeftPanel's sortMovies — by the time this screen shows, every movie in
// scope has timesRanked >= 1, so there's no "unranked" tier to special-case.
function sortMovies(movies) {
  return [...movies].sort((a, b) => {
    if (a.eloRating !== b.eloRating) return b.eloRating - a.eloRating
    return a.title.localeCompare(b.title)
  })
}

function TopTenTile({ movie, rank }) {
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

export function ResultsScreen({ movies, onSaveClick, onDismiss }) {
  const sorted = sortMovies(movies)
  const topTen = sorted.slice(0, 10)
  const elevenToTwentyFive = sorted.slice(10, 25)
  const restOfTopHundred = sorted.slice(25, 100)
  const outsideTopHundred = sorted.slice(100)

  const bigRef = useRef(null)
  const scrollRef = useRef(null)
  const midRef = useRef(null)
  const restRef = useRef(null)
  const outsideRef = useRef(null)
  const [topWidth, setTopWidth] = useState(null)
  const [heading, setHeading] = useState('10')

  // Stretches "TOP" to span the rendered width of "10" below it, so the
  // smaller word visually justifies across it instead of sitting centered
  // and narrower. Measured once, from "10" (the initial heading) — "25" and
  // "100" reuse that same width rather than each getting their own.
  useLayoutEffect(() => {
    if (bigRef.current && topWidth === null) setTopWidth(bigRef.current.offsetWidth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // As the user scrolls through the standings, the floating "TOP N" heading
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

  return (
    <div className="modal-overlay results-overlay">
      <div className="modal-card modal-card-wide results-card flex flex-col">
        {heading && (
          <p className="results-top-ten-heading">
            <span
              className="results-top-ten-heading-small"
              style={topWidth ? { width: topWidth } : undefined}
            >
              {'TOP'.split('').map((letter, i) => (
                <span key={i}>{letter}</span>
              ))}
            </span>
            <span className="results-top-ten-heading-big" ref={bigRef}>
              {heading}
            </span>
          </p>
        )}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={onDismiss}
            className="modal-close absolute top-0 right-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div ref={scrollRef} className="mt-10 min-h-0 flex-1 overflow-y-auto pr-1">
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

        <div className="mt-4 flex shrink-0 justify-end">
          <button type="button" onClick={onSaveClick} className="modal-button-primary text-sm">
            Save Ranking
          </button>
        </div>
      </div>
    </div>
  )
}
