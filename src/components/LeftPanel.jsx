import { useEffect, useRef } from 'react'
import { subsetLabel } from '../lib/genreSubsets.js'

// Sorts by eloRating descending; movies never yet ranked (still at the
// default 1000) are grouped alphabetically among themselves, per CLAUDE.md.
function sortMovies(movies) {
  return [...movies].sort((a, b) => {
    if (a.eloRating !== b.eloRating) return b.eloRating - a.eloRating
    return a.title.localeCompare(b.title)
  })
}

function StandingsRow({ movie, rank, isLast, onOpenDetail }) {
  const topClass = rank <= 3 ? `top-${rank}` : ''
  const rankedClass = movie.timesRanked >= 1 ? 'ranked' : ''
  const tensClass = rank % 10 === 0 && !isLast ? 'tens-line' : ''

  return (
    <li
      onClick={() => onOpenDetail(movie)}
      className={`standings-row flex cursor-pointer items-center gap-3 px-2 py-1.5 ${topClass} ${rankedClass} ${tensClass}`}
    >
      <span className="standings-rank w-[26px] shrink-0 text-right text-sm">{rank}</span>
      <div className="poster-placeholder h-[56px] w-[38px] shrink-0 overflow-hidden rounded-[4px] bg-cover">
        {movie.posterUrl && (
          <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium" style={{ color: 'var(--text-high)' }}>
          {movie.title}
        </p>
        <p className="font-mono text-[11px]" style={{ color: 'var(--text-low)' }}>
          {movie.year}
        </p>
      </div>
    </li>
  )
}

export function LeftPanel({ movies, subset, onOpenDetail, open }) {
  // #248: reset scroll position each time the (mobile) Standings drawer is
  // opened, rather than leaving it wherever it was scrolled to last time —
  // `open` only toggles for the drawer (desktop shows this panel inline and
  // never flips it), so this is specifically an "on open" reset, not a
  // reset on every re-render.
  const listRef = useRef(null)
  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: 0 })
  }, [open])

  // Skipped ("haven't seen") movies are excluded from pack generation and
  // the progress denominator (#136) — the Standings list itself should
  // match, rather than still showing them at their default rank (#174).
  const eligibleMovies = movies.filter((m) => !m.skipped)
  const sorted = sortMovies(eligibleMovies)
  const rankedCount = eligibleMovies.filter((m) => m.timesRanked >= 1).length
  const skippedCount = movies.filter((m) => m.skipped).length
  const eligibleCount = eligibleMovies.length

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex shrink-0 flex-col gap-0.5">
        <div className="flex items-baseline justify-between">
          <span className="standings-label text-xs font-medium uppercase">
            {subsetLabel(subset)} Standings
          </span>
          <span className="font-mono text-xs" style={{ color: 'var(--text-low)' }}>
            {rankedCount}/{eligibleCount} ranked
          </span>
        </div>
        {skippedCount > 0 && (
          <span className="self-end font-mono text-xs" style={{ color: 'var(--text-low)' }}>
            {skippedCount} skipped
          </span>
        )}
      </div>
      <ol ref={listRef} className="standings-list flex min-h-0 flex-1 flex-col overflow-y-auto pr-[15px]">
        {sorted.map((movie, index) => (
          <StandingsRow
            key={movie.id}
            movie={movie}
            rank={index + 1}
            isLast={index === sorted.length - 1}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </ol>
    </div>
  )
}
