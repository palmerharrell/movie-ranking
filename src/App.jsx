import { useEffect, useRef, useState } from 'react'
import { LeftPanel } from './components/LeftPanel.jsx'
import { RightPanel } from './components/RightPanel.jsx'
import { HeadToHeadPanel } from './components/HeadToHeadPanel.jsx'
import { PackQueue } from './components/PackQueue.jsx'
import { RankButton } from './components/RankButton.jsx'
import { SubsetPicker } from './components/SubsetPicker.jsx'
import { SaveRankingModal } from './components/SaveRankingModal.jsx'
import { ResetRankingModal } from './components/ResetRankingModal.jsx'
import { ResultsScreen } from './components/ResultsScreen.jsx'
import { LoadRankingView } from './components/LoadRankingView.jsx'
import { SkippedView } from './components/SkippedView.jsx'
import * as api from './lib/api.js'
import { selectFamilySubset } from './lib/familyMode.js'
import { selectPopular } from './lib/popularMode.js'
import { GENRE_SUBSETS, selectGenreSubset } from './lib/genreSubsets.js'
import { fetchCategoryAvoidingDuplicateLabel } from './lib/packQueue.js'
import { HEAD_TO_HEAD_TYPE } from './lib/categoryGenerator.js'

const SUBSET_STORAGE_KEY = 'movie-ranking-subset'
const QUEUE_SIZE = 8

function initialSubset() {
  const stored = localStorage.getItem(SUBSET_STORAGE_KEY)
  const validIds = ['popular', 'family', 'all', ...GENRE_SUBSETS.map((g) => g.id)]
  return validIds.includes(stored) ? stored : 'popular'
}

async function fetchPacks(family, popular, genre) {
  const packs = []
  for (let i = 0; i < QUEUE_SIZE + 1; i++) {
    const queueLabels = packs.slice(1).map((p) => p.label)
    packs.push(
      await fetchCategoryAvoidingDuplicateLabel(
        () => api.getCategory({ family, popular, genre }),
        queueLabels,
      ),
    )
  }
  return packs
}

// Skipped ("haven't seen") movies are excluded from the pool being ranked
// (#136), so completion only requires every non-skipped movie to be ranked.
function isFullyRanked(movies) {
  const eligible = movies.filter((m) => !m.skipped)
  return eligible.length > 0 && eligible.every((m) => m.timesRanked >= 1)
}

function App() {
  const [subset, setSubset] = useState(initialSubset)
  const [movies, setMovies] = useState(null)
  // packs[0] is the active pack; packs[1..] is the upcoming queue.
  const [packs, setPacks] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showResultsScreen, setShowResultsScreen] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showLoadView, setShowLoadView] = useState(false)
  const [showSkippedView, setShowSkippedView] = useState(false)
  const [showStandingsDrawer, setShowStandingsDrawer] = useState(false)
  const wasFullyRanked = useRef(false)
  // Set inside handleSkipMovie's setPacks updater, acted on by the effect
  // below once the resulting pack state has actually committed — see the
  // comment on handleSkipMovie for why this can't just be a synchronous
  // local variable read right after calling setPacks.
  const pendingSkipOutcome = useRef(null)
  const pendingQueueDiscards = useRef([])
  const [skippedMovies, setSkippedMovies] = useState([])
  // True once a skip has dropped the active pack to its last remaining
  // movie — see handleSkipMovie. While true, RightPanel shows an inline
  // "skip this one too?" prompt instead of the Rank button (#156).
  const [awaitingLastSkipConfirm, setAwaitingLastSkipConfirm] = useState(false)

  const category = packs?.[0] ?? null
  const queue = packs?.slice(1) ?? []
  const isFamily = subset === 'family'
  const isPopular = subset === 'popular'
  const activeGenre = GENRE_SUBSETS.some((g) => g.id === subset) ? subset : null

  // Prompts to save once the currently-visible pool transitions into "every
  // movie ranked at least once" — not on every subsequent Rank click while
  // it stays there. In a filtered subset "the pool" means that subset (the
  // save itself is scoped the same way — see handleSaveRanking), so this
  // fires on subset completion too, independent of the rest of the pool.
  // api.rankPack() returns the full pool's state (unfiltered), so re-apply
  // the active subset's filter client-side to keep the displayed pool
  // consistent with what's currently shown.
  function noteMoviesUpdate(updatedMovies) {
    const visibleMovies = isFamily
      ? selectFamilySubset(updatedMovies)
      : activeGenre
        ? selectGenreSubset(updatedMovies, activeGenre)
        : isPopular
          ? selectPopular(updatedMovies)
          : updatedMovies
    setMovies(visibleMovies)
    const fullyRanked = isFullyRanked(visibleMovies)
    if (fullyRanked && !wasFullyRanked.current) {
      setShowResultsScreen(true)
    }
    wasFullyRanked.current = fullyRanked
  }

  useEffect(() => {
    localStorage.setItem(SUBSET_STORAGE_KEY, subset)
  }, [subset])

  // Every subset is a different pool, so always re-fetch on change.
  useEffect(() => {
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    api
      .getMovies({ family: isFamily, popular: isPopular, genre: activeGenre })
      .then(noteMoviesUpdate)
      .catch((err) => setError(err.message))
    fetchPacks(isFamily, isPopular, activeGenre).then(setPacks).catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subset])

  function handleReorder(reorderedMovies) {
    setPacks((prev) => [{ ...prev[0], movies: reorderedMovies }, ...prev.slice(1)])
  }

  async function handleRank() {
    setBusy(true)
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    try {
      const movieIds = category.movies.map((m) => m.id)
      // Sequential: the fresh pack's overlap calculation reads timesRanked
      // from local storage, so it must run after the rank submission commits.
      const updatedMovies = await api.rankPack(movieIds)
      const freshPack = await fetchCategoryAvoidingDuplicateLabel(
        () => api.getCategory({ family: isFamily, popular: isPopular, genre: activeGenre }),
        queue.slice(1).map((p) => p.label),
      )
      noteMoviesUpdate(updatedMovies)
      setPacks((prev) => [...prev.slice(1), freshPack])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // A "Head to Head" pack submits on a single click — no drag-to-order or
  // separate "Rank ->" confirmation — since it's just a 2-movie pairwise
  // pick. Reuses the same api.rankPack() pairwise-Elo path as a normal pack.
  async function handleHeadToHeadPick(winnerId) {
    setBusy(true)
    try {
      const loserId = category.movies.find((m) => m.id !== winnerId).id
      const updatedMovies = await api.rankPack([winnerId, loserId])
      const freshPack = await fetchCategoryAvoidingDuplicateLabel(
        () => api.getCategory({ family: isFamily, popular: isPopular, genre: activeGenre }),
        queue.slice(1).map((p) => p.label),
      )
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
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    try {
      const remainingLabels = queue
        .filter((_, i) => i !== queueIndex)
        .map((p) => p.label)
      const freshPack = await fetchCategoryAvoidingDuplicateLabel(
        () => api.getCategory({ family: isFamily, popular: isPopular, genre: activeGenre }),
        remainingLabels,
      )
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

  // Discards the active pack without submitting any ranking data and
  // promotes/refills from the queue — used both when the pack empties out
  // entirely and when the user confirms skipping the last remaining movie.
  async function discardActivePack() {
    setBusy(true)
    try {
      const freshPack = await fetchCategoryAvoidingDuplicateLabel(
        () => api.getCategory({ family: isFamily, popular: isPopular, genre: activeGenre }),
        queue.slice(1).map((p) => p.label),
      )
      setPacks((prev) => [...prev.slice(1), freshPack])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Replaces any queued pack that a skip (#155) dropped to <=1 movie —
  // matched by object identity rather than index/label since packs shift
  // position as the queue advances and labels can repeat. `packs`/`queue`
  // here are the pre-skip render closure values, which is fine: a skip only
  // ever removes movies from queued packs, never changes the label of a
  // pack that's kept, so labels used to avoid duplicates stay accurate.
  async function replaceDiscardedQueuePacks(toReplace) {
    setBusy(true)
    try {
      const replacements = []
      for (const pack of toReplace) {
        const avoidLabels = [
          ...packs.filter((p) => !toReplace.includes(p)).map((p) => p.label),
          ...replacements.map((r) => r.fresh.label),
        ]
        const freshPack = await fetchCategoryAvoidingDuplicateLabel(
          () => api.getCategory({ family: isFamily, popular: isPopular, genre: activeGenre }),
          avoidLabels,
        )
        replacements.push({ old: pack, fresh: freshPack })
      }
      setPacks((prev) => prev.map((p) => replacements.find((r) => r.old === p)?.fresh ?? p))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Derive `remaining` from `prev` (not the render-time `category` closure)
  // so two near-simultaneous skip clicks can't have the second overwrite
  // the first's result. Since the setPacks updater's return value is what
  // gets committed — not a side effect you can safely read back
  // synchronously right after calling setPacks — the "what happens next"
  // decision (ask to skip the last movie? discard the empty pack? replace a
  // gutted queue pack?) is recorded into refs from inside the updater and
  // acted on from the effects below, once React has actually committed the
  // new `packs` state.
  //
  // If a skip would drop the pack to its last movie, it's no longer
  // immediately discarded (#156) — a 1-movie pack can't meaningfully be
  // ranked, but silently discarding it without asking meant a movie that
  // was never actually declined got treated the same as one the user
  // explicitly skipped. Instead the pack keeps that last movie displayed
  // and RightPanel shows an inline "skip this one too?" prompt
  // (handleConfirmSkipLast / handleDeclineSkipLast below) — a skip to 0
  // movies (declining, then skipping the last one via its own tile button)
  // still discards immediately, since there's nothing left to show.
  //
  // Queued packs were pre-generated and may already include the
  // now-skipped movie (#155) — filtering it out here (rather than waiting
  // until that pack is promoted to active) keeps a skipped movie from
  // surfacing again just because it was already baked into a
  // not-yet-selected queue pack. A queued pack that drops to <=1 movie is
  // unusable, so it's handed to replaceDiscardedQueuePacks above.
  function handleSkipMovie(movieId) {
    const skipIndex = category.movies.findIndex((m) => m.id === movieId)
    const skippedMovieRecord = category.movies[skipIndex]
    setPacks((prev) => {
      const remaining = prev[0].movies.filter((m) => m.id !== movieId)
      const activePack = { ...prev[0], movies: remaining }
      if (remaining.length === 1) {
        pendingSkipOutcome.current = 'await-confirm'
      } else if (remaining.length === 0) {
        pendingSkipOutcome.current = 'discard-empty'
      }
      const discards = []
      const updatedQueue = prev.slice(1).map((pack) => {
        if (!pack.movies.some((m) => m.id === movieId)) return pack
        const packRemaining = pack.movies.filter((m) => m.id !== movieId)
        if (packRemaining.length <= 1) {
          discards.push(pack)
          return pack
        }
        return { ...pack, movies: packRemaining }
      })
      if (discards.length > 0) {
        pendingQueueDiscards.current = discards
      }
      return [activePack, ...updatedQueue]
    })
    setSkippedMovies((prev) => [...prev, { movie: skippedMovieRecord, index: skipIndex }])
    // "Haven't seen" is a persistent fact (#136) — mark it right away, not
    // just for this pack. handleUndoSkip below reverses it.
    api.markSkipped(movieId)
    setMovies((prev) => prev.map((m) => (m.id === movieId ? { ...m, skipped: true } : m)))
  }

  // Acts on the outcome `handleSkipMovie` recorded into `pendingSkipOutcome`
  // once the pack state it depends on has actually committed.
  useEffect(() => {
    if (pendingSkipOutcome.current === 'await-confirm') {
      pendingSkipOutcome.current = null
      setAwaitingLastSkipConfirm(true)
    } else if (pendingSkipOutcome.current === 'discard-empty') {
      pendingSkipOutcome.current = null
      setSkippedMovies([])
      setAwaitingLastSkipConfirm(false)
      discardActivePack()
    }
  })

  // Replaces any queued pack `handleSkipMovie` flagged via
  // `pendingQueueDiscards`, once the pack state it depends on has actually
  // committed (see replaceDiscardedQueuePacks above).
  useEffect(() => {
    if (pendingQueueDiscards.current.length === 0) return
    const toReplace = pendingQueueDiscards.current
    pendingQueueDiscards.current = []
    replaceDiscardedQueuePacks(toReplace)
  })

  // Any movie skipped from the active pack can be restored, as long as that
  // pack is still active — identified by movie id rather than list position
  // since several skips can be pending restoration at once.
  function handleUndoSkip(movieId) {
    const entry = skippedMovies.find((s) => s.movie.id === movieId)
    if (!entry) return
    setPacks((prev) => {
      const movies = [...prev[0].movies]
      movies.splice(Math.min(entry.index, movies.length), 0, entry.movie)
      return [{ ...prev[0], movies }, ...prev.slice(1)]
    })
    setSkippedMovies((prev) => prev.filter((s) => s.movie.id !== movieId))
    api.unmarkSkipped(movieId)
    setMovies((prev) => prev.map((m) => (m.id === movieId ? { ...m, skipped: false } : m)))
    // Undoing a skip brings the pack back above 1 movie, so the "skip this
    // one too?" prompt (if showing) no longer applies.
    setAwaitingLastSkipConfirm(false)
  }

  // Un-skipping/clearing happens inside the Skipped view (#137) against the
  // *unfiltered* pool (skip state isn't scoped to a subset), so this just
  // re-fetches the active subset's movies afterward and routes the result
  // through noteMoviesUpdate — the same completion-detection path a normal
  // Rank click uses — rather than patching `movies`/`wasFullyRanked`
  // ad hoc, which previously could complete the pool without ever showing
  // the completion modal (and then permanently suppress it, since the ref
  // was already flipped to `true` with no modal shown). Also closes the
  // Skipped view itself if that completes the pool, since the completion
  // modal renders on top of it.
  function handleSkippedViewChange() {
    api
      .getMovies({ family: isFamily, popular: isPopular, genre: activeGenre })
      .then((updated) => {
        noteMoviesUpdate(updated)
        if (isFullyRanked(updated)) setShowSkippedView(false)
      })
      .catch((err) => setError(err.message))
  }

  // "Yes" on the inline "skip this one too?" prompt (#156): skip the last
  // remaining movie the same way any other tile-skip does, then discard the
  // now-empty pack and advance, mirroring the old auto-discard behavior.
  function handleConfirmSkipLast() {
    const lastMovie = category.movies[0]
    setAwaitingLastSkipConfirm(false)
    api.markSkipped(lastMovie.id)
    setMovies((prev) => prev.map((m) => (m.id === lastMovie.id ? { ...m, skipped: true } : m)))
    setSkippedMovies([])
    discardActivePack()
  }

  // "No"/dismiss on the prompt: leave the pack as-is, with just its one
  // remaining movie still displayed (and still skippable via its own tile
  // button, which re-triggers this same flow). The user can also move on
  // without deciding by picking a different pack from the queue.
  function handleDeclineSkipLast() {
    setAwaitingLastSkipConfirm(false)
  }

  async function handleSaveRanking(name) {
    // Let a failure here propagate to the modal, which shows it inline.
    // { family, popular } scopes the snapshot + reset to the active subset,
    // leaving the rest of the pool's progress untouched.
    await api.saveRanking(name, { family: isFamily, popular: isPopular, genre: activeGenre })
    setShowSaveModal(false)
    setShowResultsScreen(false)
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    wasFullyRanked.current = false

    try {
      const [updatedMovies, freshPacks] = await Promise.all([
        api.getMovies({ family: isFamily, popular: isPopular, genre: activeGenre }),
        fetchPacks(isFamily, isPopular, activeGenre),
      ])
      noteMoviesUpdate(updatedMovies)
      setPacks(freshPacks)
    } catch (err) {
      // The save already committed (snapshot posted, local state reset), so
      // drop the now-stale board rather than silently leaving it displayed.
      setMovies(null)
      setPacks(null)
      setError(err.message)
    }
  }

  async function handleResetRanking() {
    // Let a failure here propagate to the modal, which shows it inline.
    await api.resetRanking({ family: isFamily, popular: isPopular, genre: activeGenre })
    setShowResetModal(false)
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    wasFullyRanked.current = false

    try {
      const [updatedMovies, freshPacks] = await Promise.all([
        api.getMovies({ family: isFamily, popular: isPopular, genre: activeGenre }),
        fetchPacks(isFamily, isPopular, activeGenre),
      ])
      noteMoviesUpdate(updatedMovies)
      setPacks(freshPacks)
    } catch (err) {
      // The reset already committed (local state cleared), so drop the
      // now-stale board rather than silently leaving it displayed.
      setMovies(null)
      setPacks(null)
      setError(err.message)
    }
  }

  return (
    <div
      data-theme={['family', 'all'].includes(subset) ? subset : 'popular'}
      className="app-shell flex h-screen flex-col overflow-hidden"
    >
      <div className="mx-auto flex h-full w-full max-w-[1120px] min-h-0 flex-col xl:max-w-[1480px]">
        <header className="banner flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 md:h-[78px] md:flex-nowrap md:px-8 md:py-0">
          <div className="flex items-center gap-3">
            <h1 className="app-title text-[22px] md:text-[30px]">Movie Ranking</h1>
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
            <button
              type="button"
              onClick={() => setShowSkippedView(true)}
              className="banner-button"
            >
              Skipped
            </button>
            <SubsetPicker subset={subset} onChange={setSubset} />
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
              subset === 'all' ? 'md:border-r md:border-[var(--surface-border)]' : ''
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
              <LeftPanel movies={movies} onReset={() => setShowResetModal(true)} />
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
              subset === 'popular' ? 'py-4' : 'py-[26px]'
            }`}
          >
            <div className="flex w-full max-w-xl flex-col gap-4 xl:max-w-none xl:flex-row xl:items-start xl:justify-center">
              <div className="w-full xl:max-w-xl">
                {category ? (
                  category.type === HEAD_TO_HEAD_TYPE ? (
                    <HeadToHeadPanel
                      category={category}
                      onPick={handleHeadToHeadPick}
                      disabled={busy}
                    />
                  ) : (
                    <RightPanel
                      category={category}
                      onReorder={handleReorder}
                      onSkip={handleSkipMovie}
                      skippedMovies={skippedMovies}
                      onUndoSkip={handleUndoSkip}
                      awaitingLastSkipConfirm={awaitingLastSkipConfirm}
                      onConfirmSkipLast={handleConfirmSkipLast}
                      onDeclineSkipLast={handleDeclineSkipLast}
                      disabled={busy}
                    />
                  )
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
                {category?.type !== HEAD_TO_HEAD_TYPE && (
                  <div className="mt-4">
                    <RankButton
                      onClick={handleRank}
                      disabled={!category || busy || category.movies.length < 2}
                    />
                  </div>
                )}
              </div>
              {/* Beside the active pack once there's room (xl+); below it
                  (PackQueue's own top margin) on narrower windows. Skipped
                  entirely when the queue is empty so no empty column is
                  reserved next to the pack. */}
              {category && queue.length > 0 && (
                <div className="w-full xl:w-72 xl:shrink-0">
                  <PackQueue
                    queue={queue}
                    disabled={busy}
                    onSelect={handleSelectQueued}
                    className="mt-4 flex flex-col gap-2 xl:mt-0"
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {showResultsScreen && movies && (
        <ResultsScreen
          movies={movies}
          onSaveClick={() => setShowSaveModal(true)}
          onDismiss={() => setShowResultsScreen(false)}
        />
      )}
      {showSaveModal && (
        <SaveRankingModal
          onSave={handleSaveRanking}
          onDismiss={() => setShowSaveModal(false)}
          subset={subset}
        />
      )}
      {showResetModal && (
        <ResetRankingModal
          onConfirm={handleResetRanking}
          onDismiss={() => setShowResetModal(false)}
          subset={subset}
        />
      )}
      {showLoadView && <LoadRankingView onClose={() => setShowLoadView(false)} />}
      {showSkippedView && (
        <SkippedView onChange={handleSkippedViewChange} onClose={() => setShowSkippedView(false)} />
      )}
    </div>
  )
}

export default App
