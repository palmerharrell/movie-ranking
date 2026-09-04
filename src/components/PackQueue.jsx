import { applyThemeWording } from '../lib/labelWording.js'

function QueuedPackCard({ pack, theme, disabled, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="queue-pack-card flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex shrink-0 -space-x-2.5">
        {pack.movies.map((movie) => (
          <div
            key={movie.id}
            className="poster-placeholder queue-poster h-9 w-6 shrink-0 overflow-hidden rounded-[3px] bg-cover"
          >
            {movie.posterUrl && (
              <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        ))}
      </div>
      <span className="queue-pack-label truncate text-sm font-medium">
        {applyThemeWording(pack.label, theme)}
      </span>
    </button>
  )
}

export function PackQueue({ queue, theme, disabled, onSelect, className = 'mt-4 flex flex-col gap-2' }) {
  if (queue.length === 0) return null

  return (
    <div className={className}>
      <p className="queue-eyebrow text-[11px] font-medium uppercase">Up Next</p>
      <div className="flex flex-col gap-2">
        {queue.map((pack, index) => (
          <QueuedPackCard
            key={pack.movies.map((m) => m.id).join('-')}
            pack={pack}
            theme={theme}
            disabled={disabled}
            onSelect={() => onSelect(index)}
          />
        ))}
      </div>
    </div>
  )
}
