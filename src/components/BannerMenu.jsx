import { useEffect, useRef, useState } from 'react'

// Icon-only dropdown (hamburger button, no label) holding the banner actions
// that used to be individual text buttons (Standings, Load Ranking,
// Skipped) — consolidated to make room in the banner row for the PG-13
// toggle. Standings only makes sense as a menu action on mobile: on desktop
// the standings panel is always visible in the left column already, so that
// item is hidden at the md breakpoint, same as the old standalone button was.
// Instructions (#237) reopens the startup InstructionsModal on demand.
export function BannerMenu({ onStandings, onLoadRanking, onSkipped, onInstructions }) {
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

  function pick(action) {
    setOpen(false)
    action()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="banner-menu-button"
        aria-label="Menu"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span aria-hidden="true">☰</span>
      </button>
      {open && (
        <div className="banner-menu-dropdown absolute top-full left-0 z-50 mt-2">
          <button
            type="button"
            onClick={() => pick(onStandings)}
            className="banner-menu-item md:hidden"
          >
            Standings
          </button>
          <button type="button" onClick={() => pick(onLoadRanking)} className="banner-menu-item">
            Load Ranking
          </button>
          <button type="button" onClick={() => pick(onSkipped)} className="banner-menu-item">
            Skipped
          </button>
          <button type="button" onClick={() => pick(onInstructions)} className="banner-menu-item">
            Instructions
          </button>
        </div>
      )}
    </div>
  )
}
