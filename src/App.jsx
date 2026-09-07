import { useEffect, useRef, useState } from 'react'
import { LeftPanel } from './components/LeftPanel.jsx'
import { RightPanel } from './components/RightPanel.jsx'
import { HeadToHeadPanel } from './components/HeadToHeadPanel.jsx'
import { RankButton } from './components/RankButton.jsx'
import { SubsetPicker } from './components/SubsetPicker.jsx'
import { ResetRankingModal } from './components/ResetRankingModal.jsx'
import { ResultsScreen } from './components/ResultsScreen.jsx'
import { LoadRankingView } from './components/LoadRankingView.jsx'
import { SkippedView } from './components/SkippedView.jsx'
import { BannerMenu } from './components/BannerMenu.jsx'
import { InstructionsModal } from './components/InstructionsModal.jsx'
import * as api from './lib/api.js'
import { isFamilyGenre } from './lib/familyMode.js'
import { selectPopular } from './lib/popularMode.js'
import { selectPg13OrUnder } from './lib/pg13Mode.js'
import { GENRE_SUBSETS, selectGenreSubset } from './lib/genreSubsets.js'
import { fetchCategoryAvoidingDuplicateLabel } from './lib/packQueue.js'
import { HEAD_TO_HEAD_TYPE } from './lib/categoryGenerator.js'
import { generateRankingName } from './lib/rankingName.js'
import { buildShareUrl } from './lib/shareLink.js'
import filmReelBg from './assets/film-reel-bg.png'

const SUBSET_STORAGE_KEY = 'movie-ranking-subset'
// PG-13-and-under (#193) is a global toggle, not tied to the active subset —
// it persists across subset switches (mirrors SUBSET_STORAGE_KEY's own
// persistence, just as its own independent flag).
const PG13_STORAGE_KEY = 'movie-ranking-pg13'
// The "how it works" popup (replacing the old always-visible pack-card
// captions) shows once per browser on startup unless dismissed with "Don't
// show this again" — same shape as PG13_STORAGE_KEY's persistent flag.
const INSTRUCTIONS_STORAGE_KEY = 'movie-ranking-hide-instructions'
const QUEUE_SIZE = 8

function initialSubset() {
  const stored = localStorage.getItem(SUBSET_STORAGE_KEY)
  const validIds = ['popular', 'family', 'all', ...GENRE_SUBSETS.map((g) => g.id)]
  return validIds.includes(stored) ? stored : 'popular'
}

function initialPg13() {
  return localStorage.getItem(PG13_STORAGE_KEY) === 'true'
}

function initialShowInstructions() {
  return localStorage.getItem(INSTRUCTIONS_STORAGE_KEY) !== 'true'
}

async function fetchPacks(family, popular, genre, pg13) {
  const packs = []
  for (let i = 0; i < QUEUE_SIZE + 1; i++) {
    const queueLabels = packs.slice(1).map((p) => p.label)
    packs.push(
      await fetchCategoryAvoidingDuplicateLabel(
        () => api.getCategory({ family, popular, genre, pg13 }),
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
  const [pg13, setPg13] = useState(initialPg13)
  const [movies, setMovies] = useState(null)
  // packs[0] is the active pack; packs[1..] is the upcoming queue.
  const [packs, setPacks] = useState(null)
  const [error, setError] = useState(null)
  // Set when a subset-switch fetch fails while stale (previous-subset)
  // movies/packs are still on screen — see the effect below and #178.
  // Kept separate from `error` because the full-page error branches key off
  // `movies`/`category` being falsy, which isn't true during a subset
  // switch; this instead drives an inline banner alongside the stale
  // content, with a retry action.
  const [subsetSwitchError, setSubsetSwitchError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [switchingSubset, setSwitchingSubset] = useState(false)
  const [showResultsScreen, setShowResultsScreen] = useState(false)
  // Name the just-completed ranking was auto-saved under (#227) — shown as
  // the Results screen's title so the user can see what it got called.
  const [resultsTitle, setResultsTitle] = useState(null)
  // The auto-saved ranking's share slug (#220) — saveRanking hands one back
  // immediately, so the Share button works right away with no extra round
  // trip.
  const [resultsShareSlug, setResultsShareSlug] = useState(null)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showLoadView, setShowLoadView] = useState(false)
  const [showSkippedView, setShowSkippedView] = useState(false)
  const [showStandingsDrawer, setShowStandingsDrawer] = useState(false)
  const [showInstructionsModal, setShowInstructionsModal] = useState(initialShowInstructions)
  // Total unfiltered pool size, shown in the picker's "All (nnnn)" label
  // (#182/#183) — fetched once since it's independent of the active subset.
  const [allMoviesCount, setAllMoviesCount] = useState(null)
  const wasFullyRanked = useRef(false)
  // Guards against rapid subset switching: only the most recent subset's
  // fetch is allowed to apply its results or clear switchingSubset, so an
  // older switch's fetch resolving after a newer one can't clobber the
  // newer subset's data or hide its still-in-flight loading overlay.
  const subsetFetchId = useRef(0)
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
  // Family always applies the PG-13-and-under filter (#200), regardless of
  // the toggle's own state — the toggle itself just reflects that visually
  // (forced on and disabled — see the checkbox below) without touching the
  // user's underlying `pg13` preference, so leaving Family restores it.
  const effectivePg13 = isFamily || pg13

  // Mirrors the server's getMovies filter pipeline (server/rankingService.js)
  // exactly: family filter, then the pg13 toggle (#193), then one top-N
  // strategy (genre subset, or the shared Popular top-N — used by both the
  // Popular subset itself and, per #150's pattern, as Family's own cap).
  // api.rankPack() returns the full pool's state (unfiltered), so this is
  // what re-derives "the currently-visible subset" from it client-side.
  function computeVisibleMovies(updatedMovies) {
    let result = isFamily ? updatedMovies.filter(isFamilyGenre) : updatedMovies
    if (effectivePg13) result = selectPg13OrUnder(result)
    if (activeGenre) return selectGenreSubset(result, activeGenre)
    if (isPopular || isFamily) return selectPopular(result)
    return result
  }

  // Auto-saves once the currently-visible pool transitions into "every movie
  // ranked at least once" — not on every subsequent Rank click while it
  // stays there. In a filtered subset "the pool" means that subset (the save
  // itself is scoped the same way — see autoSaveCompletedRanking), so this
  // fires on subset completion too, independent of the rest of the pool.
  function noteMoviesUpdate(updatedMovies) {
    const visibleMovies = computeVisibleMovies(updatedMovies)
    setMovies(visibleMovies)
    const fullyRanked = isFullyRanked(visibleMovies)
    if (fullyRanked && !wasFullyRanked.current) {
      autoSaveCompletedRanking()
    }
    wasFullyRanked.current = fullyRanked
  }

  // Replaces the old "Ranking Complete" naming modal (#227): completion now
  // auto-saves immediately under a generated name, and the Results screen
  // (shown either way) just reports what it was saved as via `resultsTitle`.
  // A failure here surfaces the same as any other API error — the Results
  // screen simply doesn't appear, matching how a failed manual save used to
  // leave the modal up with an inline error, just without a modal to retry
  // from; the completed state isn't lost, so the next `noteMoviesUpdate`
  // call (e.g. after switching back to this subset) will retry the save.
  async function autoSaveCompletedRanking() {
    const name = generateRankingName(subset, effectivePg13)
    let saved
    try {
      saved = await api.saveRanking(name, {
        family: isFamily,
        popular: isPopular,
        genre: activeGenre,
        pg13: effectivePg13,
        subset,
      })
    } catch (err) {
      setError(err.message)
      return
    }
    setResultsTitle(name)
    setResultsShareSlug(saved.shareSlug)
    setShowResultsScreen(true)
  }

  // The live Results screen's Share button (#220) — the slug is already
  // known from the auto-save above, so this is just building the link and
  // copying it; ResultsScreen owns the click-feedback state.
  async function handleShareResults() {
    await navigator.clipboard.writeText(buildShareUrl(resultsShareSlug))
  }

  useEffect(() => {
    localStorage.setItem(SUBSET_STORAGE_KEY, subset)
  }, [subset])

  useEffect(() => {
    localStorage.setItem(PG13_STORAGE_KEY, String(pg13))
  }, [pg13])

  useEffect(() => {
    api.getMovies().then((allMovies) => setAllMoviesCount(allMovies.length))
  }, [])

  // Fetches the active subset's movies/packs. Used both by the effect below
  // on subset change and by the banner's Retry action after a failure —
  // retrying re-runs this without touching skip/prompt state, since those
  // were already reset by the switch that triggered the failed attempt.
  // A failure while `movies`/`category` are still populated (a subset
  // switch, since old data stays on screen — see #175) surfaces as an
  // inline banner (`subsetSwitchError`) instead of the full-page error
  // branches, which only render when `movies`/`category` are falsy (#178).
  function loadSubset() {
    const hadMovies = movies !== null
    setSwitchingSubset(true)
    setSubsetSwitchError(null)
    const fetchId = ++subsetFetchId.current
    const isStale = () => fetchId !== subsetFetchId.current
    Promise.all([
      api
        .getMovies({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 })
        .then((updated) => {
          if (!isStale()) noteMoviesUpdate(updated)
        }),
      fetchPacks(isFamily, isPopular, activeGenre, effectivePg13).then((freshPacks) => {
        if (!isStale()) setPacks(freshPacks)
      }),
    ])
      .catch((err) => {
        if (isStale()) return
        if (hadMovies) {
          setSubsetSwitchError(err.message)
        } else {
          setError(err.message)
        }
      })
      .finally(() => {
        if (!isStale()) setSwitchingSubset(false)
      })
  }

  // Every subset is a different pool, so always re-fetch on change — and the
  // PG-13-and-under toggle (#193) changes the pool the same way a subset
  // switch does, despite being a global flag rather than the subset itself.
  // Old `movies`/`packs` stay on screen (not reset to null) while this is in
  // flight, so `switchingSubset` drives a loading overlay over the stale
  // pack/queue rather than the "Loading…" text used for the initial load,
  // which would otherwise flash the previous subset's content for a beat
  // before this settles (#175).
  useEffect(() => {
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    loadSubset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subset, pg13])

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
        () => api.getCategory({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
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
        () => api.getCategory({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
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
        () => api.getCategory({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
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
        () => api.getCategory({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
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
          () => api.getCategory({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
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
  // now-skipped movie (#155) — any such pack is discarded and replaced
  // wholesale via replaceDiscardedQueuePacks above, rather than just
  // filtering the skipped movie out of it in place. Packs are always meant
  // to be a fixed size (5, or 2 for Head to Head) — quietly shrinking one in
  // place instead of regenerating it left the door open for a queued pack
  // to lose several movies across separate skips over time and eventually
  // surface with too few tiles (#218).
  function handleSkipMovie(movieId) {
    // The pack is already down to its one remaining movie and awaiting the
    // "skip this one too?" decision (#156) — clicking that same movie's own
    // tile button in this state re-offers the prompt rather than executing
    // an unconfirmed skip (#195). Without this guard, filtering it out here
    // would drop `remaining` to 0 and hit the discard-empty branch below,
    // silently marking it skipped with no confirmation at all.
    if (category.movies.length === 1 && category.movies[0].id === movieId) {
      setAwaitingLastSkipConfirm(true)
      return
    }
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
      const discards = prev.slice(1).filter((pack) => pack.movies.some((m) => m.id === movieId))
      if (discards.length > 0) {
        pendingQueueDiscards.current = discards
      }
      return [activePack, ...prev.slice(1)]
    })
    setSkippedMovies((prev) => [...prev, { movie: skippedMovieRecord, index: skipIndex }])
    // "Haven't seen" is a persistent fact (#136) — mark it right away, not
    // just for this pack. handleUndoSkip below reverses it. markSkipped also
    // resets eloRating/timesRanked to defaults (#169), so mirror that in
    // local `movies` state too rather than leaving the stale pre-skip rating
    // displayed until the next refetch.
    api.markSkipped(movieId)
    setMovies((prev) =>
      prev.map((m) => (m.id === movieId ? { ...m, skipped: true, eloRating: 1000, timesRanked: 0 } : m))
    )
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
    // Full reversal (#169), unlike the persistent Skipped-view unmarkSkipped
    // path — restores the exact eloRating/timesRanked markSkipped wiped,
    // since entry.movie still holds that pre-skip data.
    api.restoreSkipped(movieId, entry.movie.eloRating, entry.movie.timesRanked)
    setMovies((prev) =>
      prev.map((m) =>
        m.id === movieId
          ? { ...m, skipped: false, eloRating: entry.movie.eloRating, timesRanked: entry.movie.timesRanked }
          : m
      )
    )
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
      .getMovies({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 })
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
    setMovies((prev) =>
      prev.map((m) => (m.id === lastMovie.id ? { ...m, skipped: true, eloRating: 1000, timesRanked: 0 } : m))
    )
    setSkippedMovies([])
    discardActivePack()
  }

  // "No" on the prompt (#195): leave the lone remaining movie unskipped, but
  // don't strand the user on a pack that can't be ranked (Rank → is disabled
  // below 2 movies) — discard it and advance to the next queued pack, the
  // same way declining a full-empty pack already does. Mirrors "Yes"
  // (handleConfirmSkipLast) in advancing the queue; the only difference is
  // this one never calls api.markSkipped.
  function handleDeclineSkipLast() {
    setAwaitingLastSkipConfirm(false)
    setSkippedMovies([])
    discardActivePack()
  }

  function handleCloseInstructions(dontShowAgain) {
    if (dontShowAgain) localStorage.setItem(INSTRUCTIONS_STORAGE_KEY, 'true')
    setShowInstructionsModal(false)
  }

  // The ranking is already auto-saved by the time this runs (see
  // autoSaveCompletedRanking) — dismissing the Results screen just starts a
  // fresh run for this scope, the same reset-and-refetch that used to
  // follow a manual save.
  async function handleResultsDismiss() {
    setShowResultsScreen(false)
    setResultsTitle(null)
    setResultsShareSlug(null)
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    wasFullyRanked.current = false

    try {
      const [updatedMovies, freshPacks] = await Promise.all([
        api.getMovies({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
        fetchPacks(isFamily, isPopular, activeGenre, effectivePg13),
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
    await api.resetRanking({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 })
    setShowResetModal(false)
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    wasFullyRanked.current = false

    try {
      const [updatedMovies, freshPacks] = await Promise.all([
        api.getMovies({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
        fetchPacks(isFamily, isPopular, activeGenre, effectivePg13),
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
      data-theme="popular"
      className="app-shell flex h-screen flex-col overflow-hidden"
      style={{ '--film-reel-bg-url': `url(${filmReelBg})` }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1120px] min-h-0 flex-col xl:max-w-[1480px]">
        <header className="banner flex shrink-0 flex-col gap-2 px-4 py-3 md:px-8 md:py-4">
          <div className="app-title-badge flex w-fit items-center justify-center self-center gap-2 rounded-full px-1 md:gap-3 md:px-1.5">
            <img
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt=""
              aria-hidden="true"
              className="app-title-icon h-[34px] w-[34px] shrink-0 md:h-[46px] md:w-[46px]"
            />
            <h1 className="app-title text-center text-[22px] md:text-[30px]">Movie Ranking</h1>
            <img
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt=""
              aria-hidden="true"
              className="app-title-icon h-[34px] w-[34px] shrink-0 md:h-[46px] md:w-[46px]"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <BannerMenu
              onStandings={() => setShowStandingsDrawer(true)}
              onLoadRanking={() => setShowLoadView(true)}
              onSkipped={() => setShowSkippedView(true)}
            />
            <SubsetPicker subset={subset} onChange={setSubset} allMoviesCount={allMoviesCount} />
            <label
              className="pg13-toggle flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em]"
              title={isFamily ? 'Family always applies the PG-13 & Under filter' : undefined}
            >
              PG-13 &amp; Under
              <input
                type="checkbox"
                checked={effectivePg13}
                disabled={isFamily}
                onChange={(event) => setPg13(event.target.checked)}
              />
            </label>
          </div>
        </header>

        {subsetSwitchError && (
          <div className="mx-4 mt-2 flex shrink-0 items-center justify-between gap-3 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300 md:mx-8">
            <span>Couldn't switch subsets: {subsetSwitchError}</span>
            <div className="flex shrink-0 items-center gap-3">
              <button type="button" onClick={loadSubset} className="underline">
                Retry
              </button>
              <button
                type="button"
                onClick={() => setSubsetSwitchError(null)}
                aria-label="Dismiss"
                className="text-base leading-none"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="relative grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_1fr]">
          {showStandingsDrawer && (
            <div
              className="fixed inset-0 z-30 bg-black/55 md:hidden"
              onClick={() => setShowStandingsDrawer(false)}
            />
          )}

          <aside
            className={`standings-col fixed inset-y-0 left-0 z-40 min-h-0 w-[85vw] max-w-[340px] bg-[var(--bg-page)] shadow-[8px_0_24px_rgba(0,0,0,0.4)] transition-transform duration-200 md:static md:z-auto md:w-auto md:max-w-none md:translate-x-0 md:bg-transparent md:shadow-none ${showStandingsDrawer ? 'translate-x-0' : '-translate-x-full'}`}
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

          <main className="flex min-h-0 flex-col items-center overflow-y-auto px-4 py-4 md:px-8">
            <div className="w-full max-w-xl">
              {category ? (
                category.type === HEAD_TO_HEAD_TYPE ? (
                  <HeadToHeadPanel
                    category={category}
                    onPick={handleHeadToHeadPick}
                    disabled={busy || switchingSubset}
                    queue={queue}
                    onSelectQueued={handleSelectQueued}
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
                    disabled={busy || switchingSubset}
                    queue={queue}
                    onSelectQueued={handleSelectQueued}
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
                    disabled={!category || busy || switchingSubset || category.movies.length < 2}
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
          title={resultsTitle}
          subtitle="Saved automatically"
          onDismiss={handleResultsDismiss}
          onShare={resultsShareSlug ? handleShareResults : undefined}
        />
      )}
      {showResetModal && (
        <ResetRankingModal
          onConfirm={handleResetRanking}
          onDismiss={() => setShowResetModal(false)}
          subset={subset}
          pg13={effectivePg13}
        />
      )}
      {showLoadView && (
        <LoadRankingView subset={subset} pg13={effectivePg13} onClose={() => setShowLoadView(false)} />
      )}
      {showSkippedView && (
        <SkippedView onChange={handleSkippedViewChange} onClose={() => setShowSkippedView(false)} />
      )}
      {showInstructionsModal && <InstructionsModal onClose={handleCloseInstructions} />}
    </div>
  )
}

export default App
