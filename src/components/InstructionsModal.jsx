import { useState } from 'react'

// Shown once at startup (see localRankingStore's INSTRUCTIONS_STORAGE_KEY
// handling in App.jsx) in place of the old always-visible captions on the
// pack card ("Drag to reorder...", "Click the one you'd rank higher") —
// those took up header space on every pack; a one-time popup covers the
// same ground without that per-pack cost.
export function InstructionsModal({ onClose }) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

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
            list), Load Ranking (browse saved rankings), and Skipped
            (review/un-skip &ldquo;haven&rsquo;t seen&rdquo; movies).
          </li>
          <li>
            <strong>Queue button</strong> (top-right of the pack) — jump straight
            to one of the upcoming packs instead of ranking the current one.
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
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
          />
          Don&rsquo;t show this again
        </label>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => onClose(dontShowAgain)}
            className="modal-button-primary text-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
