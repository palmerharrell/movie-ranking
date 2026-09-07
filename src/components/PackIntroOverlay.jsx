// Screen-filling announcement shown for a couple of seconds before a Head
// to Head or Top 10 Tough Choice pack becomes interactive (#298) — these
// packs interrupt the normal drag-and-order flow with a very different,
// single-click UI, so a beat of announcement text helps the switch read as
// intentional rather than a jarring layout change.
export function PackIntroOverlay({ label, fading }) {
  return (
    <div
      className={`pack-intro-overlay${fading ? ' pack-intro-fading' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="pack-intro-text">{label}!</span>
    </div>
  )
}
