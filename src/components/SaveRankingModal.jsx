import { useState } from 'react'

export function SaveRankingModal({ onSave, onDismiss }) {
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
        <h2 className="modal-title mt-1 text-xl font-semibold">Every movie has been ranked</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-mid)' }}>
          Give this ranking a name to save it. Saving resets the board so you can start a fresh
          ranking run.
        </p>
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
