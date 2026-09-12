import { useEffect, useRef, useState } from 'react'
import { GENRE_SUBSETS, LANGUAGE_SUBSET_IDS, subsetLabel } from '../lib/genreSubsets.js'

const CURATED_SUBSETS = [{ id: 'popular', label: 'Popular' }]

// Family isn't part of GENRE_SUBSETS (its own familyMode.js logic), but per
// #183 it's grouped with the other genre-style subsets in the picker.
const FAMILY_SUBSET = { id: 'family', label: 'Family' }

// British is TMDb production-country based rather than genre/language, but
// per #183 it's grouped with the genre subsets in the picker too — there's
// no dedicated "Country" group left once it moves.
const GENRE_ONLY_SUBSETS = GENRE_SUBSETS.filter((g) => !LANGUAGE_SUBSET_IDS.includes(g.id))
const LANGUAGE_SUBSETS = GENRE_SUBSETS.filter((g) => LANGUAGE_SUBSET_IDS.includes(g.id))

function SubsetOption({ id, label, active, onPick }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={() => onPick(id)}
      className={`subset-dropdown-item ${active ? 'subset-dropdown-item--active' : ''}`}
    >
      {label}
    </button>
  )
}

// #316: the active subset is a big, prominent banner (`subsetLabel`, the
// same shared label used by Save/Reset/Load's own copy) rather than living
// inside the picker control itself, with a small "Switch" button beneath
// it to change it. A custom dropdown (mirroring BannerMenu.jsx's own
// open/close/click-outside/Escape pattern) replaces the native `<select>`
// entirely — the OS's own popup styling for a `<select>` can't be themed
// to match the app's dark surfaces/accent colors the way a hand-built
// listbox can.
export function SubsetPicker({ subset, onChange, allMoviesCount, directorSubsets = [] }) {
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

  function pick(id) {
    setOpen(false)
    onChange(id)
  }

  return (
    <div className="subset-picker flex flex-col items-center gap-2">
      <span className="subset-banner text-center uppercase">{subsetLabel(subset)}</span>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="subset-switch-button"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          Switch
          <span className="subset-switch-arrow" aria-hidden="true">
            ▾
          </span>
        </button>
        {open && (
          <div
            role="listbox"
            aria-label="Switch subset"
            className="subset-dropdown absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2"
          >
            <div className="subset-dropdown-group-label">Curated Lists</div>
            {CURATED_SUBSETS.map((s) => (
              <SubsetOption key={s.id} id={s.id} label={s.label} active={subset === s.id} onPick={pick} />
            ))}
            <div className="subset-dropdown-group-label">Genres</div>
            <SubsetOption
              id={FAMILY_SUBSET.id}
              label={FAMILY_SUBSET.label}
              active={subset === FAMILY_SUBSET.id}
              onPick={pick}
            />
            {GENRE_ONLY_SUBSETS.map((s) => (
              <SubsetOption key={s.id} id={s.id} label={s.label} active={subset === s.id} onPick={pick} />
            ))}
            <div className="subset-dropdown-group-label">Language</div>
            {LANGUAGE_SUBSETS.map((s) => (
              <SubsetOption key={s.id} id={s.id} label={s.label} active={subset === s.id} onPick={pick} />
            ))}
            {directorSubsets.length > 0 && (
              <>
                <div className="subset-dropdown-group-label">Directors</div>
                {directorSubsets.map((s) => (
                  <SubsetOption key={s.id} id={s.id} label={s.label} active={subset === s.id} onPick={pick} />
                ))}
              </>
            )}
            <div className="subset-dropdown-group-label">Not Recommended</div>
            <SubsetOption
              id="all"
              label={`All${allMoviesCount != null ? ` (${allMoviesCount})` : ''}`}
              active={subset === 'all'}
              onPick={pick}
            />
          </div>
        )}
      </div>
    </div>
  )
}
