import { useState } from 'react'

const COPY = {
  popular: {
    title: 'Reset the popular ranking?',
    body: 'This clears all progress on the popular movies without saving it — the rest of your pool is untouched. This cannot be undone.',
  },
  family: {
    title: 'Reset the family-friendly ranking?',
    body: 'This clears all progress on the family-friendly movies without saving it — the rest of your pool is untouched. This cannot be undone.',
  },
  all: {
    title: 'Reset the ranking?',
    body: 'This clears all progress on the current ranking without saving it. This cannot be undone.',
  },
}

export function ResetRankingModal({ onConfirm, onDismiss, subset }) {
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
        <h2 className="modal-title mt-1 text-xl font-semibold">{COPY[subset].title}</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-mid)' }}>{COPY[subset].body}</p>
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
