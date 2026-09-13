import { useEffect, useState } from 'react'
import { PackLoadingOverlay } from './PackLoadingOverlay.jsx'
import { formatPackLabel } from '../lib/labelWording.js'

// Total time the winner is held, filling the frame (scale + the 900ms
// h2hWinFlash border animation in index.css both run within this window),
// before the pick is actually submitted and the pack advances.
const WIN_HOLD_MS = 1500

function HeadToHeadPoster({ movie, side, isFront, isWinner, isLoser, onTap, onOpenDetail, disabled }) {
  const classes = [
    'head-to-head-poster',
    `side-${side}`,
    isFront ? 'is-front' : '',
    isWinner ? 'is-winner' : '',
    isLoser ? 'is-loser' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onTap()}
      onKeyDown={(event) => {
        if (disabled) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onTap()
        }
      }}
      aria-disabled={disabled}
      className={`poster-placeholder ${classes}`}
    >
      {movie.posterUrl && <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />}
      {/* Info button (#223) — full titles are truncated in the caption
          below; this is the only way to see one in full without picking a
          winner. Stops propagation so tapping it doesn't also select/confirm. */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onOpenDetail(movie)
        }}
        disabled={disabled}
        className="movie-detail-info-button absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-xs font-bold disabled:cursor-not-allowed"
        aria-label={`See full details for ${movie.title}`}
      >
        i
      </button>
    </div>
  )
}

// A "Head to Head" pack is 2 already-ranked movies. Tapping one brings it to
// the front (no ranking data submitted yet); tapping the front poster again
// opens a confirm dialog, so a mis-tap can never cast a vote. Confirming
// plays the win animation (scale-to-fill + border flash), holds briefly,
// then submits the pairwise pick and the pack advances.
export function HeadToHeadPanel({ category, onPick, disabled, onOpenDetail }) {
  const [first, second] = category.movies
  const packKey = `${first.id}:${second.id}`
  const [front, setFront] = useState('left') // 'left' | 'right' — which poster is in front
  const [confirming, setConfirming] = useState(false)
  const [winnerSide, setWinnerSide] = useState(null) // 'left' | 'right' | null

  // A fresh pack (new category) always starts clean — no stale selection,
  // confirmation, or winner state leaking from the previous matchup.
  useEffect(() => {
    setFront('left')
    setConfirming(false)
    setWinnerSide(null)
  }, [category])

  const frontMovie = front === 'left' ? first : second
  const backMovie = front === 'left' ? second : first

  function handleTap(side) {
    if (disabled || winnerSide || confirming) return
    if (side === front) {
      setConfirming(true)
    } else {
      setFront(side)
    }
  }

  function handleCancel() {
    setConfirming(false)
  }

  function handleConfirm() {
    setConfirming(false)
    setWinnerSide(front)
    setTimeout(() => {
      onPick(frontMovie.id)
    }, WIN_HOLD_MS)
  }

  return (
    <div className="pack-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="pack-category-label">{formatPackLabel(category.label)}</h2>
      </div>

      <div className="head-to-head-stage">
        <HeadToHeadPoster
          key={`left-${packKey}`}
          movie={first}
          side="left"
          isFront={!winnerSide && front === 'left'}
          isWinner={winnerSide === 'left'}
          isLoser={winnerSide === 'right'}
          onTap={() => handleTap('left')}
          onOpenDetail={onOpenDetail}
          disabled={disabled || !!winnerSide}
        />
        <HeadToHeadPoster
          key={`right-${packKey}`}
          movie={second}
          side="right"
          isFront={!winnerSide && front === 'right'}
          isWinner={winnerSide === 'right'}
          isLoser={winnerSide === 'left'}
          onTap={() => handleTap('right')}
          onOpenDetail={onOpenDetail}
          disabled={disabled || !!winnerSide}
        />

        {confirming && (
          <div className="head-to-head-confirm-overlay">
            <div className="head-to-head-confirm-card">
              <p>
                Rank <strong>{frontMovie.title}</strong> above <strong>{backMovie.title}</strong>?
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="modal-button-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="modal-button-primary text-sm"
                  style={{ background: '#f04f8c', color: '#0b1224' }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!confirming && !winnerSide && (
        <div className="head-to-head-caption">
          <p className="truncate text-[17px] font-bold" style={{ color: 'var(--text-high)' }}>
            {frontMovie.title}
          </p>
          {frontMovie.director && (
            <p className="movie-tile-credits truncate text-xs">Directed by: {frontMovie.director}</p>
          )}
          <p className="head-to-head-hint mt-1">Tap again to confirm</p>
        </div>
      )}

      {disabled && <PackLoadingOverlay />}
    </div>
  )
}
