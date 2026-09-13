import { useState } from 'react'

// Lets the user save the current (already fully-ranked) run under a typed
// name, without disturbing local ranking state — reusable any number of
// times, since Save no longer resets progress (see App.jsx's
// handleSaveResults). `defaultName` pre-fills the input with the same
// generated name auto-save used to pick, editable before confirming.
export function SaveRankingModal({ defaultName, onConfirm, onDismiss }) {
  const [name, setName] = useState(defaultName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onConfirm(name.trim())
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <p className="modal-eyebrow text-[11px] font-medium uppercase">Save Ranking</p>
        <h2 className="modal-title mt-1 text-xl font-semibold">Name this ranking</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="modal-input mt-3"
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={saving}
            className="modal-button-secondary text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !name.trim()}
            className="modal-button-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
