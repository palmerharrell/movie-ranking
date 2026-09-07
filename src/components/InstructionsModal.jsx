import { useState } from 'react'

// Shown once at startup (see localRankingStore's INSTRUCTIONS_STORAGE_KEY
// handling in App.jsx) in place of the old always-visible captions on the
// pack card ("Drag to reorder...", "Click the one you'd rank higher") —
// those took up header space on every pack; a one-time popup covers the
// same ground without that per-pack cost. Also reachable any time from the
// ☰ menu's "Instructions" item (#237), in which case `initialShowOnLoad`
// reflects whatever the stored preference currently is rather than always
// defaulting to checked.
export function InstructionsModal({ onClose, initialShowOnLoad = true }) {
  const [showOnLoad, setShowOnLoad] = useState(initialShowOnLoad)

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <p className="modal-eyebrow text-[11px] font-medium uppercase">How It Works</p>
        <h2 className="modal-title mt-1 text-xl font-semibold">Ranking movies</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-mid)' }}>
          Drag the tiles to reorder them, then click <strong>Rank →</strong> to set that
          order and move to the next pack.
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-mid)' }}>
          For Head to Head packs, just click the movie you&rsquo;d rank higher.
        </p>
        <ul
          className="mt-3 flex flex-col gap-1.5 text-sm"
          style={{ color: 'var(--text-mid)' }}
        >
          <li>
            <strong>☰ menu</strong> — Standings (this browser&rsquo;s live ranked
            list), Load Ranking (browse saved rankings), Skipped
            (review/un-skip &ldquo;haven&rsquo;t seen&rdquo; movies), and
            Instructions (reopen this guide).
          </li>
          <li>
            Every so often you&rsquo;ll get to <strong>choose your next
            pack</strong> from 3 options instead of one just appearing.
          </li>
          <li>
            <strong>Subset picker</strong> — switch which pool of movies
            you&rsquo;re ranking (Popular, Family, a genre or language, etc.);
            each subset tracks its own progress and saved rankings.
          </li>
          <li>
            <strong>PG-13 &amp; Under</strong> — restrict whichever subset is
            active to G/PG/PG-13 movies only.
          </li>
        </ul>
        <label
          className="mt-4 flex items-center gap-2 text-sm"
          style={{ color: 'var(--text-mid)' }}
        >
          <input
            type="checkbox"
            checked={showOnLoad}
            onChange={(event) => setShowOnLoad(event.target.checked)}
          />
          Show on load
        </label>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => onClose(showOnLoad)}
            className="modal-button-primary text-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
