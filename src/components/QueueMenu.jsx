import { useEffect, useRef, useState } from 'react'
import { formatPackLabel } from '../lib/labelWording.js'

function QueuedPackCard({ pack, disabled, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="queue-pack-card flex w-full items-center gap-3.5 rounded-lg border px-3.5 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex shrink-0 -space-x-2.5">
        {pack.movies.map((movie) => (
          <div
            key={movie.id}
            className="poster-placeholder queue-poster h-11 w-7 shrink-0 overflow-hidden rounded-[3px] bg-cover"
          >
            {movie.posterUrl && (
              <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        ))}
      </div>
      <span className="queue-pack-label truncate text-base font-medium">
        {formatPackLabel(pack.label)}
      </span>
    </button>
  )
}

// Dropdown replacing the old always-visible side column — sits in the pack
// card's own header, top-right, next to the pack's category label. Lines of
// decreasing width plus a forward arrow reads as "queue/up next" on its
// own, but pairs it with an "Up Next" label (#275) rather than relying on
// the icon alone, distinct from BannerMenu's plain hamburger.
function QueueIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="10" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="1" y="7.25" width="10" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="1" y="11.5" width="6" height="1.5" rx="0.75" fill="currentColor" />
      <path
        d="M13 5.5L15 8L13 10.5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function QueueMenu({ queue, disabled, onSelect }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (queue.length === 0) return null

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        className="queue-menu-button"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="queue-menu-label">Up Next</span>
        <QueueIcon />
      </button>
      {open && (
        <div className="queue-menu-dropdown absolute top-full right-0 z-50 mt-2 flex flex-col gap-3">
          {queue.map((pack, index) => (
            <QueuedPackCard
              key={pack.movies.map((m) => m.id).join('-')}
              pack={pack}
              disabled={disabled}
              onSelect={() => {
                setOpen(false)
                onSelect(index)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
