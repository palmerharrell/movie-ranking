import { useEffect, useRef, useState } from 'react'
import { LeftPanel } from './components/LeftPanel.jsx'
import { RightPanel } from './components/RightPanel.jsx'
import { PackQueue } from './components/PackQueue.jsx'
import { RankButton } from './components/RankButton.jsx'
import { ThemeToggle } from './components/ThemeToggle.jsx'
import { SaveRankingModal } from './components/SaveRankingModal.jsx'
import { LoadRankingView } from './components/LoadRankingView.jsx'
import * as api from './lib/api.js'
import { isFamilySafe } from './lib/familyMode.js'

const THEME_STORAGE_KEY = 'movie-ranking-theme'
const QUEUE_SIZE = 3

function initialTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return ['classic', 'neon', 'family'].includes(stored) ? stored : 'classic'
}

function fetchPacks(family) {
  return Promise.all(
    Array.from({ length: QUEUE_SIZE + 1 }, () => api.getCategory({ family })),
  )
}

function isFullyRanked(movies) {
  return movies.length > 0 && movies.every((m) => m.timesRanked >= 1)
}

function App() {
  const [theme, setTheme] = useState(initialTheme)
  const [movies, setMovies] = useState(null)
  // packs[0] is the active pack; packs[1..] is the upcoming queue.
  const [packs, setPacks] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadView, setShowLoadView] = useState(false)
  const [showStandingsDrawer, setShowStandingsDrawer] = useState(false)
  const wasFullyRanked = useRef(false)
  const pendingSkipDiscard = useRef(false)

  const category = packs?.[0] ?? null
  const queue = packs?.slice(1) ?? []
  const isFamily = theme === 'family'

  // Prompts to save once the currently-visible pool transitions into "every
  // movie ranked at least once" — not on every subsequent Rank click while
  // it stays there. In Family mode "the pool" means the family-safe subset
  // (the save itself is scoped the same way — see handleSaveRanking), so
  // this fires on family-subset completion too, independent of the rest of
  // the pool.
  // POST /api/rank returns the full pool's state (unfiltered), so re-apply
  // the family filter client-side to keep the displayed pool consistent
  // with what's currently shown while family mode is active.
  function noteMoviesUpdate(updatedMovies) {
    const visibleMovies = isFamily ? updatedMovies.filter(isFamilySafe) : updatedMovies
    setMovies(visibleMovies)
    const fullyRanked = isFullyRanked(visibleMovies)
    if (fullyRanked && !wasFullyRanked.current) {
      setShowSaveModal(true)
    }
    wasFullyRanked.current = fullyRanked
  }

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  // Re-fetch when family-mode-ness flips (different pool), not on every
  // Classic <-> Neon swap (same pool, cosmetic only).
  useEffect(() => {
    api.getMovies({ family: isFamily }).then(noteMoviesUpdate).catch((err) => setError(err.message))
    fetchPacks(isFamily).then(setPacks).catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFamily])

  function handleReorder(reorderedMovies) {
    setPacks((prev) => [{ ...prev[0], movies: reorderedMovies }, ...prev.slice(1)])
  }

  async function handleRank() {
    setBusy(true)
    try {
      const movieIds = category.movies.map((m) => m.id)
      // Sequential: the fresh pack's overlap calculation reads timesRanked
      // from the DB, so it must run after the rank submission commits.
      const updatedMovies = await api.rankPack(movieIds)
      const freshPack = await api.getCategory({ family: isFamily })
      noteMoviesUpdate(updatedMovies)
      setPacks((prev) => [...prev.slice(1), freshPack])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSelectQueued(queueIndex) {
    setBusy(true)
    try {
      const freshPack = await api.getCategory({ family: isFamily })
      setPacks((prev) => {
        const packIndex = queueIndex + 1
        const selected = prev[packIndex]
        const rest = prev.filter((_, i) => i !== 0 && i !== packIndex)
        return [selected, ...rest, freshPack]
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Derive `remaining` from `prev` (not the render-time `category` closure)
  // so two near-simultaneous skip clicks can't have the second overwrite
  // the first's result. Since the setState updater runs during React's
  // update processing (not synchronously here), the decision to discard the
  // pack is recorded in a ref and acted on from an effect once the state
  // update has actually committed.
  function handleSkipMovie(movieId) {
    setPacks((prev) => {
      const remaining = prev[0].movies.filter((m) => m.id !== movieId)
      if (remaining.length <= 1) {
        pendingSkipDiscard.current = true
        return [...prev]
      }
      return [{ ...prev[0], movies: remaining }, ...prev.slice(1)]
    })
  }

  useEffect(() => {
    if (!pendingSkipDiscard.current) return
    pendingSkipDiscard.current = false

    // Fewer than 2 movies left to rank — move on without collecting ranking data.
    ;(async () => {
      setBusy(true)
      try {
        const freshPack = await api.getCategory({ family: isFamily })
        setPacks((prev) => [...prev.slice(1), freshPack])
      } catch (err) {
        setError(err.message)
      } finally {
        setBusy(false)
      }
    })()
  })

  async function handleSaveRanking(name) {
    // Let a failure here propagate to the modal, which shows it inline.
    // { family: isFamily } scopes the snapshot + reset to the family-safe
    // subset when saving from Family mode, leaving the rest of the pool's
    // progress untouched.
    await api.saveRanking(name, { family: isFamily })
    setShowSaveModal(false)
    wasFullyRanked.current = false

    try {
      const [updatedMovies, freshPacks] = await Promise.all([
        api.getMovies({ family: isFamily }),
        fetchPacks(isFamily),
      ])
      noteMoviesUpdate(updatedMovies)
      setPacks(freshPacks)
    } catch (err) {
      // The save already committed server-side (including the state reset),
      // so drop the now-stale board rather than silently leaving it displayed.
      setMovies(null)
      setPacks(null)
      setError(err.message)
    }
  }

  return (
    <div data-theme={theme} className="app-shell flex h-screen flex-col overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-[1120px] min-h-0 flex-col">
        <header className="banner flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 md:h-[78px] md:flex-nowrap md:px-8 md:py-0">
          <div className="flex items-center gap-3">
            {theme === 'classic' && (
              <div className="hidden items-center gap-1.5 sm:flex">
                <span className="marquee-bulb" />
                <span className="marquee-bulb pulsing" />
                <span className="marquee-bulb pulsing" style={{ animationDelay: '1.2s' }} />
              </div>
            )}
            <h1 className="app-title text-[22px] md:text-[30px]">
              {theme === 'neon' ? (
                <>
                  Movie <span className="accent">Ranking</span>
                </>
              ) : (
                'Movie Ranking'
              )}
            </h1>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setShowStandingsDrawer(true)}
              className="banner-button mr-2 md:hidden"
            >
              Standings
            </button>
            <button type="button" onClick={() => setShowLoadView(true)} className="banner-button">
              Load Ranking
            </button>
            <ThemeToggle theme={theme} onChange={setTheme} />
          </div>
        </header>

        <div className="relative grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_1fr]">
          {showStandingsDrawer && (
            <div
              className="fixed inset-0 z-30 bg-black/55 md:hidden"
              onClick={() => setShowStandingsDrawer(false)}
            />
          )}

          <aside
            className={`standings-col fixed inset-y-0 left-0 z-40 min-h-0 w-[85vw] max-w-[340px] bg-[var(--bg-page)] shadow-[8px_0_24px_rgba(0,0,0,0.4)] transition-transform duration-200 md:static md:z-auto md:w-auto md:max-w-none md:translate-x-0 md:bg-transparent md:shadow-none ${
              theme === 'classic' ? 'md:border-r md:border-[var(--surface-border)]' : ''
            } ${showStandingsDrawer ? 'translate-x-0' : '-translate-x-full'}`}
            style={{ padding: '22px 8px 22px 22px' }}
          >
            <div className="mb-2 flex justify-end md:hidden">
              <button
                type="button"
                onClick={() => setShowStandingsDrawer(false)}
                className="modal-close"
                aria-label="Close standings"
              >
                ×
              </button>
            </div>
            {movies ? (
              <LeftPanel movies={movies} />
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-low)' }}>
                Loading…
              </p>
            )}
          </aside>

          <main
            className={`flex min-h-0 flex-col items-center overflow-y-auto px-4 md:px-8 ${
              theme === 'neon' ? 'py-4' : 'py-[26px]'
            }`}
          >
            <div className="w-full max-w-xl">
              {category ? (
                <RightPanel
                  category={category}
                  onReorder={handleReorder}
                  onSkip={handleSkipMovie}
                  disabled={busy}
                  theme={theme}
                />
              ) : error ? (
                <p className="text-sm text-red-400">{error}</p>
              ) : movies ? (
                <p className="text-sm" style={{ color: 'var(--text-low)' }}>
                  Not enough movies to build a category yet.
                </p>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-low)' }}>
                  Loading…
                </p>
              )}
              {category && (
                <PackQueue queue={queue} theme={theme} disabled={busy} onSelect={handleSelectQueued} />
              )}
              <div className="mt-4">
                <RankButton onClick={handleRank} disabled={!category || busy} />
              </div>
            </div>
          </main>
        </div>
      </div>

      {showSaveModal && (
        <SaveRankingModal
          onSave={handleSaveRanking}
          onDismiss={() => setShowSaveModal(false)}
          isFamily={isFamily}
        />
      )}
      {showLoadView && <LoadRankingView onClose={() => setShowLoadView(false)} />}
    </div>
  )
}

export default App
