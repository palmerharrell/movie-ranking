import { GENRE_SUBSETS, LANGUAGE_SUBSET_IDS } from '../lib/genreSubsets.js'

const GENERAL_SUBSETS = [
  { id: 'popular', label: 'Popular' },
  { id: 'family', label: 'Family (PG-13)' },
  { id: 'all', label: 'All Movies' },
]

const GENRE_ONLY_SUBSETS = GENRE_SUBSETS.filter((g) => !LANGUAGE_SUBSET_IDS.includes(g.id))
const LANGUAGE_SUBSETS = GENRE_SUBSETS.filter((g) => LANGUAGE_SUBSET_IDS.includes(g.id))

export function SubsetPicker({ subset, onChange }) {
  return (
    <select
      value={subset}
      onChange={(event) => onChange(event.target.value)}
      className="subset-select ml-3.5 text-[11px] font-medium uppercase tracking-[0.1em]"
    >
      <optgroup label="Subsets">
        {GENERAL_SUBSETS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Genres">
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
    </select>
  )
}
