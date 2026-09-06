import { useState } from 'react'
import { subsetLabel } from '../lib/genreSubsets.js'

const FIXED_COPY = {
  family: {
    title: 'Every movie in Family has been ranked',
    body: 'Give this ranking a name to save it. Saving resets just the Family movies so you can start a fresh Family ranking run — the rest of your pool is untouched.',
  },
  all: {
    title: 'Every movie has been ranked',
    body: 'Give this ranking a name to save it. Saving resets the board so you can start a fresh ranking run.',
  },
}

// Popular and every genre/language subset (#150) share one generic template
// rather than a bespoke entry per id — there are too many to hand-write.
// `pg13` (#193) appends its own qualifier to whichever label results, since
// it composes with every subset rather than being one itself.
function copyFor(subset, pg13) {
  const base = FIXED_COPY[subset] ?? {
    title: `Every movie in ${subsetLabel(subset)} has been ranked`,
    body: `Give this ranking a name to save it. Saving resets just the ${subsetLabel(subset)} movies so you can start a fresh ${subsetLabel(subset)} ranking run — the rest of your pool is untouched.`,
  }
  if (!pg13) return base
  return {
    title: `${base.title} (PG-13 & Under)`,
    body: base.body,
  }
}

export function SaveRankingModal({ onSave, onDismiss, subset, pg13 }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setSaving(true)
    setError(null)
    try {
      await onSave(trimmed)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <p className="modal-eyebrow text-[11px] font-medium uppercase">Ranking Complete</p>
        <h2 className="modal-title mt-1 text-xl font-semibold">{copyFor(subset, pg13).title}</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-mid)' }}>{copyFor(subset, pg13).body}</p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. 2026 Draft"
            autoFocus
            className="modal-input"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onDismiss}
              disabled={saving}
              className="modal-button-secondary text-sm"
            >
              Not now
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="modal-button-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Ranking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
