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

// #316: the active subset is now a big, prominent banner (`subsetLabel`,
// the same shared label used by Save/Reset/Load's own copy) rather than
// living inside the picker control itself — the actual `<select>` shrinks
// to a small "Switch" button instead. The select stays a real, fully
// functional `<select>` (native picker UI, keyboard/screen-reader support)
// — it's just visually reduced to `subset-select-trigger`'s small pill
// size, with its own rendered value hidden (`color: transparent` in
// index.css, since the banner already shows that value) and a separate
// `subset-select-label` span rendering the visible "Switch" text in its
// place. `aria-label` gives the control an accessible name matching that
// visible text, since its own rendered option text is invisible.
export function SubsetPicker({ subset, onChange, allMoviesCount }) {
  return (
    <div className="subset-picker flex flex-col items-center gap-2">
      <span className="subset-banner text-center uppercase">{subsetLabel(subset)}</span>
      <div className="subset-select-wrap">
        <select
          value={subset}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Switch subset"
          className="subset-select-trigger text-[15px] font-medium uppercase tracking-[0.07em]"
        >
          <optgroup label="Curated Lists">
            {CURATED_SUBSETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Genres">
            <option value={FAMILY_SUBSET.id}>{FAMILY_SUBSET.label}</option>
            {GENRE_ONLY_SUBSETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Language">
            {LANGUAGE_SUBSETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Not Recommended">
            <option value="all">All{allMoviesCount != null ? ` (${allMoviesCount})` : ''}</option>
          </optgroup>
        </select>
        <span className="subset-select-label" aria-hidden="true">
          Switch
        </span>
        <span className="subset-select-arrow" aria-hidden="true">
          ▾
        </span>
      </div>
    </div>
  )
}
