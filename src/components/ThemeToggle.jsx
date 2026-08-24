const THEMES = [
  { id: 'classic', label: 'Classic' },
  { id: 'neon', label: 'Neon' },
]

export function ThemeToggle({ theme, onChange }) {
  return (
    <div className="theme-toggle ml-3.5">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`theme-toggle-segment text-[11px] font-medium uppercase tracking-[0.1em] ${
            theme === t.id ? 'active' : ''
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
