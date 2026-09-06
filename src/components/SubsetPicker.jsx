import { GENRE_SUBSETS, LANGUAGE_SUBSET_IDS } from '../lib/genreSubsets.js'

const CURATED_SUBSETS = [{ id: 'popular', label: 'Popular' }]

// Family isn't part of GENRE_SUBSETS (its own familyMode.js logic), but per
// #183 it's grouped with the other genre-style subsets in the picker.
const FAMILY_SUBSET = { id: 'family', label: 'Family' }

// British is TMDb production-country based rather than genre/language, but
// per #183 it's grouped with the genre subsets in the picker too — there's
// no dedicated "Country" group left once it moves.
const GENRE_ONLY_SUBSETS = GENRE_SUBSETS.filter((g) => !LANGUAGE_SUBSET_IDS.includes(g.id))
const LANGUAGE_SUBSETS = GENRE_SUBSETS.filter((g) => LANGUAGE_SUBSET_IDS.includes(g.id))

export function SubsetPicker({ subset, onChange, allMoviesCount }) {
  return (
    <select
      value={subset}
      onChange={(event) => onChange(event.target.value)}
      className="subset-select ml-3.5 text-[11px] font-medium uppercase tracking-[0.1em]"
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
  )
}
