const SUBSETS = [
  { id: 'popular', label: 'Popular' },
  { id: 'family', label: 'Family (PG-13)' },
  { id: 'all', label: 'All Movies' },
]

export function SubsetPicker({ subset, onChange }) {
  return (
    <div className="subset-toggle ml-3.5">
      {SUBSETS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={`subset-toggle-segment text-[11px] font-medium uppercase tracking-[0.1em] ${
            subset === s.id ? 'active' : ''
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
