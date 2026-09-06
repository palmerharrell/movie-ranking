import { useState } from 'react'
import { subsetLabel } from '../lib/genreSubsets.js'

const FIXED_COPY = {
  family: {
    title: 'Reset the Family ranking?',
    body: 'This clears all progress on the Family movies without saving it — the rest of your pool is untouched. This cannot be undone.',
  },
  all: {
    title: 'Reset the ranking?',
    body: 'This clears all progress on the current ranking without saving it. This cannot be undone.',
  },
}

// Popular and every genre/language subset (#150) share one generic template
// rather than a bespoke entry per id — there are too many to hand-write.
// `pg13` (#193) appends its own qualifier to whichever label results, since
// it composes with every subset rather than being one itself.
function copyFor(subset, pg13) {
  const base = FIXED_COPY[subset] ?? {
    title: `Reset the ${subsetLabel(subset)} ranking?`,
    body: `This clears all progress on the ${subsetLabel(subset)} movies without saving it — the rest of your pool is untouched. This cannot be undone.`,
  }
  if (!pg13) return base
  return {
    title: `${base.title} (PG-13 & Under)`,
    body: base.body,
  }
}

export function ResetRankingModal({ onConfirm, onDismiss, subset, pg13 }) {
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    setResetting(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message)
      setResetting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <p className="modal-eyebrow text-[11px] font-medium uppercase">Reset Ranking</p>
        <h2 className="modal-title mt-1 text-xl font-semibold">{copyFor(subset, pg13).title}</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-mid)' }}>{copyFor(subset, pg13).body}</p>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={resetting}
            className="modal-button-secondary text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={resetting}
            className="modal-button-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resetting ? 'Resetting…' : 'Reset'}
          </button>
        </div>
      </div>
    </div>
  )
}
