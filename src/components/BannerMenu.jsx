import { useEffect, useRef, useState } from 'react'

// Icon-only dropdown (hamburger button, no label) holding the banner actions
// that used to be individual text buttons (Standings, Load Ranking,
// Skipped) — consolidated to make room in the banner row for the PG-13
// toggle. Standings only makes sense as a menu action on mobile: on desktop
// the standings panel is always visible in the left column already, so that
// item is hidden at the md breakpoint, same as the old standalone button was.
// Instructions (#237) reopens the startup InstructionsModal on demand.
//
// The PG-13 & Under checkbox (#272) moved in here from its own spot in the
// banner row, freeing up space there for the subset picker (#274). Unlike
// the other items, picking it doesn't close the menu (no `pick()` call) —
// it's a toggle the user may want to flip more than once in a row, and
// closing on every click would hide the checked-state feedback.
export function BannerMenu({
  onStandings,
  onLoadRanking,
  onSkipped,
  onInstructions,
  pg13Checked,
  pg13Disabled,
  pg13Title,
  onPg13Change,
}) {
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
          <hr className="banner-menu-divider" />
          <label
            className="banner-menu-item banner-menu-checkbox-item"
            title={pg13Title}
          >
            PG-13 &amp; Under
            <input
              type="checkbox"
              checked={pg13Checked}
              disabled={pg13Disabled}
              onChange={(event) => onPg13Change(event.target.checked)}
            />
          </label>
        </div>
      )}
    </div>
  )
}
