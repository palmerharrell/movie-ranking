import { useEffect, useState } from 'react'
import * as api from '../lib/api.js'

// The app's landing gate (#361) — shown before any subset/pack loads, so
// picking up the app is an explicit choice rather than always dropping back
// into whatever subset was last active. "Start a New Ranking" hands off to
// NewRankingScreen's full-screen subset list; "Continue" hands off to
// ContinueRankingScreen's list of saved snapshots to resume/refine. Continue
// stays disabled until we know at least one saved ranking exists anywhere
// (any subset/pg13) — there'd be nothing to pick from otherwise.
export function StartScreen({ onStartNew, onContinue }) {
  const [hasSavedRankings, setHasSavedRankings] = useState(null) // null = still checking

  useEffect(() => {
    let cancelled = false
    api
      .getSavedRankings()
      .then((rankings) => {
        if (!cancelled) setHasSavedRankings(rankings.some((r) => r.subset))
      })
      .catch(() => {
        if (!cancelled) setHasSavedRankings(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="start-screen-body flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <h1 className="start-screen-title">Movie Ranker</h1>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <button type="button" onClick={onStartNew} className="modal-button-primary start-screen-button">
          Start a New Ranking
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!hasSavedRankings}
          className="modal-button-secondary start-screen-button start-screen-button--secondary"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
