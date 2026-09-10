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
import { MovieDetailModal } from './components/MovieDetailModal.jsx'
import { PackIntroOverlay } from './components/PackIntroOverlay.jsx'
import { PackChoiceScreen } from './components/PackChoiceScreen.jsx'
import * as api from './lib/api.js'
import { isFamilyGenre } from './lib/familyMode.js'
import { selectPopular } from './lib/popularMode.js'
import { selectPg13OrUnder } from './lib/pg13Mode.js'
import { GENRE_SUBSETS, selectGenreSubset } from './lib/genreSubsets.js'
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
// captions) shows once per browser on startup unless its "Show on load"
// checkbox (#236, checked by default) is unchecked — same shape as
// PG13_STORAGE_KEY's persistent flag, just inverted (the stored value marks
// "hidden", even though the checkbox itself reads as "show"). Also
// reachable any time from the ☰ menu's "Instructions" item (#237).
const INSTRUCTIONS_STORAGE_KEY = 'movie-ranking-hide-instructions'
// Light/Dark Mode (#265) — independent of the subset picker's own palette
// (every subset already shares one look, see data-theme='popular' in
// index.css); this just flips a separate set of CSS custom properties.
// Persists across sessions like the other banner toggles above.
const COLOR_MODE_STORAGE_KEY = 'movie-ranking-color-mode'
// How long the Head to Head / Top 10 Tough Choice intro announcement
// (#298) is shown before it starts fading, and how long the fade itself
// takes — must match .pack-intro-overlay's own transition duration in
// index.css so the overlay is actually gone (not just transparent and
// still blocking clicks) by the time it unmounts.
const PACK_INTRO_DISPLAY_MS = 1400
const PACK_INTRO_FADE_MS = 300
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

function initialColorMode() {
  const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY)
  return stored === 'light' ? 'light' : 'dark'
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
  const [colorMode, setColorMode] = useState(initialColorMode)
  const [movies, setMovies] = useState(null)
  // The current turn (#297): either a single forced pack to rank
  // (`{ type: 'pack', pack }`) or a 3-way choice of candidate packs
  // (`{ type: 'choice', options }`) — replacing the old pre-generated
  // "Up Next" queue. `null` while nothing has loaded yet.
  const [turn, setTurn] = useState(null)
  const [error, setError] = useState(null)
  // Set when a subset-switch fetch fails while stale (previous-subset)
  // movies/turn are still on screen — see the effect below and #178.
  // Kept separate from `error` because the full-page error branches key off
  // `movies`/`activePack` being falsy, which isn't true during a subset
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
  // The movie shown in the big detail card (#222, #223) — tapping/clicking a
  // movie in a pack, the standings, the skipped list, or a Head to Head
  // card's own info button opens it; null when no detail card is showing.
  const [detailMovie, setDetailMovie] = useState(null)
  // Total unfiltered pool size, shown in the picker's "All (nnnn)" label
  // (#182/#183) — fetched once since it's independent of the active subset.
  const [allMoviesCount, setAllMoviesCount] = useState(null)
  const wasFullyRanked = useRef(false)
  // Guards against rapid subset switching: only the most recent subset's
  // fetch is allowed to apply its results or clear switchingSubset, so an
  // older switch's fetch resolving after a newer one can't clobber the
  // newer subset's data or hide its still-in-flight loading overlay.
  const subsetFetchId = useRef(0)
  // Set inside handleSkipMovie's setTurn updater, acted on by the effect
  // below once the resulting turn state has actually committed — see the
  // comment on handleSkipMovie for why this can't just be a synchronous
  // local variable read right after calling setTurn.
  const pendingSkipOutcome = useRef(null)
  const [skippedMovies, setSkippedMovies] = useState([])
  // True once a skip has dropped the active pack to its last remaining
  // movie — see handleSkipMovie. While true, RightPanel shows an inline
  // "skip this one too?" prompt instead of the Rank button (#156).
  const [awaitingLastSkipConfirm, setAwaitingLastSkipConfirm] = useState(false)
  // Screen-filling "Head to Head!"/"Top 10 Tough Choice!" announcement
  // (#298) shown for a beat before one of those packs becomes interactive
  // — see the effect below. `label` is the announced pack's own category
  // label (so the overlay text always matches); `fading` drives the CSS
  // opacity transition before the overlay unmounts.
  const [packIntro, setPackIntro] = useState(null) // { label, fading } | null

  // The single active pack when the current turn is a normal (or Head to
  // Head/Tough Choice) pack — null while a 3-way choice is pending or
  // nothing has loaded yet.
  const activePack = turn?.type === 'pack' ? turn.pack : null
  // Backs the two edge tabs (#271) as well as the old inline ranked/skipped
  // counts they replaced — hoisted here since both needed the same three
  // values, previously recomputed separately in the Head to Head and normal
  // pack branches below.
  const eligibleMovies = movies ? movies.filter((m) => !m.skipped) : []
  const rankedCount = eligibleMovies.filter((m) => m.timesRanked >= 1).length
  const skippedCount = movies ? movies.filter((m) => m.skipped).length : 0
  const eligibleCount = eligibleMovies.length
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
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode)
  }, [colorMode])

  useEffect(() => {
    api.getMovies().then((allMovies) => setAllMoviesCount(allMovies.length))
  }, [])

  // #247: the Standings drawer and Skipped view are both fixed-position
  // overlays, which doesn't stop the page underneath from scrolling on
  // touch devices — locking body scroll while either is open keeps the
  // background still.
  useEffect(() => {
    if (!showStandingsDrawer && !showSkippedView) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showStandingsDrawer, showSkippedView])

  // Announces a Head to Head / Top 10 Tough Choice pack (#298) with a
  // screen-filling "<label>!" overlay for a beat before it's shown — fires
  // whenever `activePack` itself changes (a fresh reference every time a
  // pack is promoted to active, whether via "Rank ->", a pack-choice pick,
  // or a subset switch) and the newly-active pack is one of those two
  // types. Distinguishing "Head to Head" from "Top 10 Tough Choice" is just
  // a matter of using the pack's own label — both share HEAD_TO_HEAD_TYPE.
  useEffect(() => {
    if (!activePack || activePack.type !== HEAD_TO_HEAD_TYPE) {
      setPackIntro(null)
      return undefined
    }
    setPackIntro({ label: activePack.label, fading: false })
    const fadeTimer = setTimeout(
      () => setPackIntro((prev) => (prev ? { ...prev, fading: true } : prev)),
      PACK_INTRO_DISPLAY_MS
    )
    const removeTimer = setTimeout(
      () => setPackIntro(null),
      PACK_INTRO_DISPLAY_MS + PACK_INTRO_FADE_MS
    )
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [activePack])

  // Fetches the active subset's movies/turn. Used both by the effect below
  // on subset change and by the banner's Retry action after a failure —
  // retrying re-runs this without touching skip/prompt state, since those
  // were already reset by the switch that triggered the failed attempt.
  // A failure while `movies`/`activePack` are still populated (a subset
  // switch, since old data stays on screen — see #175) surfaces as an
  // inline banner (`subsetSwitchError`) instead of the full-page error
  // branches, which only render when `movies`/`activePack` are falsy (#178).
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
      api
        .getNextTurn({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 })
        .then((nextTurn) => {
          if (!isStale()) setTurn(nextTurn)
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
  // Old `movies`/`turn` stay on screen (not reset to null) while this is in
  // flight, so `switchingSubset` drives a loading overlay over the stale
  // pack rather than the "Loading…" text used for the initial load, which
  // would otherwise flash the previous subset's content for a beat before
  // this settles (#175).
  useEffect(() => {
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    loadSubset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subset, pg13])

  function handleReorder(reorderedMovies) {
    setTurn((prev) => ({ type: 'pack', pack: { ...prev.pack, movies: reorderedMovies } }))
  }

  async function handleRank() {
    setBusy(true)
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    try {
      const movieIds = activePack.movies.map((m) => m.id)
      // Sequential: the fresh turn's overlap calculation reads timesRanked
      // from local storage, so it must run after the rank submission commits.
      const updatedMovies = await api.rankPack(movieIds)
      const nextTurn = await api.getNextTurn({
        family: isFamily,
        popular: isPopular,
        genre: activeGenre,
        pg13: effectivePg13,
      })
      noteMoviesUpdate(updatedMovies)
      setTurn(nextTurn)
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
      const loserId = activePack.movies.find((m) => m.id !== winnerId).id
      const updatedMovies = await api.rankPack([winnerId, loserId])
      const nextTurn = await api.getNextTurn({
        family: isFamily,
        popular: isPopular,
        genre: activeGenre,
        pg13: effectivePg13,
      })
      noteMoviesUpdate(updatedMovies)
      setTurn(nextTurn)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Picking one of the 3 offered candidate packs (#297) — the other two are
  // simply discarded (never submitted, never shown again). No network call:
  // unlike the old "Up Next" queue, there's nothing to backfill here — the
  // *next* turn is only generated once this chosen pack actually gets
  // ranked/submitted.
  function handleChoosePack(index) {
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    setTurn((prev) => (prev?.type === 'choice' ? { type: 'pack', pack: prev.options[index] } : prev))
  }

  // Discards the active pack without submitting any ranking data and
  // fetches the next turn — used both when the pack empties out entirely
  // and when the user confirms skipping the last remaining movie.
  async function discardActivePack() {
    setBusy(true)
    try {
      const nextTurn = await api.getNextTurn({
        family: isFamily,
        popular: isPopular,
        genre: activeGenre,
        pg13: effectivePg13,
      })
      setTurn(nextTurn)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Derive `remaining` from `prev` (not the render-time `activePack`
  // closure) so two near-simultaneous skip clicks can't have the second
  // overwrite the first's result. Since the setTurn updater's return value
  // is what gets committed — not a side effect you can safely read back
  // synchronously right after calling setTurn — the "what happens next"
  // decision (ask to skip the last movie? discard the empty pack?) is
  // recorded into a ref from inside the updater and acted on from the
  // effect below, once React has actually committed the new `turn` state.
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
  // Unlike the old pre-generated "Up Next" queue (#155/#218), there's no
  // separate queued-pack staleness problem to handle here anymore — every
  // turn (forced pack or 3-way choice) is generated fresh, on demand, from
  // the pool's current eligible movies, so a newly-skipped movie can never
  // resurface in one.
  function handleSkipMovie(movieId) {
    // The pack is already down to its one remaining movie and awaiting the
    // "skip this one too?" decision (#156) — clicking that same movie's own
    // tile button in this state re-offers the prompt rather than executing
    // an unconfirmed skip (#195). Without this guard, filtering it out here
    // would drop `remaining` to 0 and hit the discard-empty branch below,
    // silently marking it skipped with no confirmation at all.
    if (activePack.movies.length === 1 && activePack.movies[0].id === movieId) {
      setAwaitingLastSkipConfirm(true)
      return
    }
    const skipIndex = activePack.movies.findIndex((m) => m.id === movieId)
    const skippedMovieRecord = activePack.movies[skipIndex]
    setTurn((prev) => {
      const remaining = prev.pack.movies.filter((m) => m.id !== movieId)
      if (remaining.length === 1) {
        pendingSkipOutcome.current = 'await-confirm'
      } else if (remaining.length === 0) {
        pendingSkipOutcome.current = 'discard-empty'
      }
      return { type: 'pack', pack: { ...prev.pack, movies: remaining } }
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

  // Any movie skipped from the active pack can be restored, as long as that
  // pack is still active — identified by movie id rather than list position
  // since several skips can be pending restoration at once.
  function handleUndoSkip(movieId) {
    const entry = skippedMovies.find((s) => s.movie.id === movieId)
    if (!entry) return
    setTurn((prev) => {
      const movies = [...prev.pack.movies]
      movies.splice(Math.min(entry.index, movies.length), 0, entry.movie)
      return { type: 'pack', pack: { ...prev.pack, movies } }
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
    const lastMovie = activePack.movies[0]
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
  // below 2 movies) — discard it and advance to the next turn, the same way
  // declining a full-empty pack already does. Mirrors "Yes"
  // (handleConfirmSkipLast) in advancing; the only difference is this one
  // never calls api.markSkipped.
  function handleDeclineSkipLast() {
    setAwaitingLastSkipConfirm(false)
    setSkippedMovies([])
    discardActivePack()
  }

  function handleCloseInstructions(showOnLoad) {
    if (showOnLoad) {
      localStorage.removeItem(INSTRUCTIONS_STORAGE_KEY)
    } else {
      localStorage.setItem(INSTRUCTIONS_STORAGE_KEY, 'true')
    }
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
      const [updatedMovies, nextTurn] = await Promise.all([
        api.getMovies({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
        api.getNextTurn({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
      ])
      noteMoviesUpdate(updatedMovies)
      setTurn(nextTurn)
    } catch (err) {
      // The save already committed (snapshot posted, local state reset), so
      // drop the now-stale board rather than silently leaving it displayed.
      setMovies(null)
      setTurn(null)
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
      const [updatedMovies, nextTurn] = await Promise.all([
        api.getMovies({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
        api.getNextTurn({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
      ])
      noteMoviesUpdate(updatedMovies)
      setTurn(nextTurn)
    } catch (err) {
      // The reset already committed (local state cleared), so drop the
      // now-stale board rather than silently leaving it displayed.
      setMovies(null)
      setTurn(null)
      setError(err.message)
    }
  }

  return (
    <div
      data-theme="popular"
      data-color-mode={colorMode}
      className="app-shell flex h-screen flex-col overflow-hidden"
      style={{ '--film-reel-bg-url': `url(${filmReelBg})` }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1120px] min-h-0 flex-col xl:max-w-[1480px]">
        <header className="banner relative flex shrink-0 flex-col gap-2 px-4 py-3 md:px-8 md:py-4">
          <div className="absolute left-3 top-3 md:left-8 md:top-4">
            <BannerMenu
              onStandings={() => setShowStandingsDrawer(true)}
              onLoadRanking={() => setShowLoadView(true)}
              onSkipped={() => setShowSkippedView(true)}
              onInstructions={() => setShowInstructionsModal(true)}
              pg13Checked={effectivePg13}
              pg13Disabled={isFamily}
              pg13Title={isFamily ? 'Family always applies the PG-13 & Under filter' : undefined}
              onPg13Change={setPg13}
            />
          </div>
          <button
            type="button"
            onClick={() => setColorMode((mode) => (mode === 'dark' ? 'light' : 'dark'))}
            className="theme-toggle-button absolute right-3 top-3 md:right-8 md:top-4"
            aria-label={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {colorMode === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="app-title-badge flex w-fit items-center justify-center self-center gap-2 rounded-full px-1 md:gap-3 md:px-1.5">
            <img
              src={`${import.meta.env.BASE_URL}${colorMode === 'light' ? 'favicon-light.svg' : 'favicon.svg'}`}
              alt=""
              aria-hidden="true"
              className="app-title-icon h-[34px] w-[34px] shrink-0 md:h-[46px] md:w-[46px]"
            />
            <h1 className="app-title text-center text-[22px] md:text-[30px]">Movie Ranking</h1>
            <img
              src={`${import.meta.env.BASE_URL}${colorMode === 'light' ? 'favicon-light.svg' : 'favicon.svg'}`}
              alt=""
              aria-hidden="true"
              className="app-title-icon h-[34px] w-[34px] shrink-0 md:h-[46px] md:w-[46px]"
            />
          </div>
          <div className="flex items-center justify-center gap-3">
            <SubsetPicker subset={subset} onChange={setSubset} allMoviesCount={allMoviesCount} />
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
          {/* Edge tabs (#271): replace the old inline ranked/skipped counts
              with tab handles pinned to the window edge, doubling as the
              way to slide out their respective drawer. The Ranked tab is
              mobile-only (md:hidden) since desktop already shows the
              Standings panel inline at the left edge — a tab to open
              something already open would be redundant. The Skipped tab
              stays on desktop too, since that drawer (#269) is a fixed
              overlay on every breakpoint, not just mobile. Each hides
              itself while its own drawer is open, since the drawer already
              occupies that edge. Vertical position is a plain fixed CSS
              value (`.edge-tab`'s `bottom` in index.css, #312 follow-up)
              rather than something JS-measured off the Rank button — the
              button's own position barely moves pack to pack, and trying to
              track it exactly (#289's original approach) kept landing the
              tabs in the wrong place on screens with no Rank button of
              their own (pack-choice, Head to Head, Top 10 Tough Choice) —
              simpler, and no worse in practice, to just fix it in place. */}
          {movies && (
            <button
              type="button"
              onClick={() => setShowStandingsDrawer(true)}
              className={`edge-tab edge-tab-left z-20 flex-col items-center gap-0.5 rounded-r-lg pl-3 pr-2 py-3 font-mono text-[11px] leading-tight uppercase tracking-wide md:hidden ${showStandingsDrawer ? 'hidden' : 'flex'}`}
              style={{
                background: 'var(--surface)',
                borderTop: '1px solid var(--surface-border)',
                borderRight: '1px solid var(--surface-border)',
                borderBottom: '1px solid var(--surface-border)',
                boxShadow: 'var(--surface-shadow)',
                color: 'var(--text-low)',
              }}
            >
              <span className="text-[13px] font-semibold normal-case" style={{ color: 'var(--text-high)' }}>
                {rankedCount}/{eligibleCount}
              </span>
              <span>Ranked</span>
            </button>
          )}
          {skippedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowSkippedView(true)}
              className={`edge-tab edge-tab-right z-20 flex-col items-center gap-0.5 rounded-l-lg pl-3 pr-2 py-3 font-mono text-[11px] leading-tight uppercase tracking-wide ${showSkippedView ? 'hidden' : 'flex'}`}
              style={{
                background: 'var(--surface)',
                borderTop: '1px solid var(--surface-border)',
                borderLeft: '1px solid var(--surface-border)',
                borderBottom: '1px solid var(--surface-border)',
                boxShadow: 'var(--surface-shadow)',
                color: 'var(--text-low)',
              }}
            >
              <span className="text-[13px] font-semibold normal-case" style={{ color: 'var(--text-high)' }}>
                {skippedCount}
              </span>
              <span>Skipped</span>
            </button>
          )}

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
              <LeftPanel
                movies={movies}
                onReset={() => setShowResetModal(true)}
                onOpenDetail={setDetailMovie}
                open={showStandingsDrawer}
              />
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-low)' }}>
                Loading…
              </p>
            )}
          </aside>

          <main className="flex min-h-0 flex-col items-center overflow-y-auto px-4 pt-4 pb-32 md:px-8">
            <div className="w-full max-w-xl">
              {turn?.type === 'choice' ? (
                <PackChoiceScreen
                  options={turn.options}
                  onChoose={handleChoosePack}
                  disabled={switchingSubset}
                />
              ) : activePack ? (
                activePack.type === HEAD_TO_HEAD_TYPE ? (
                  <HeadToHeadPanel
                    category={activePack}
                    onPick={handleHeadToHeadPick}
                    disabled={busy || switchingSubset || !!packIntro}
                    onOpenDetail={setDetailMovie}
                  />
                ) : (
                  <RightPanel
                    category={activePack}
                    onReorder={handleReorder}
                    onSkip={handleSkipMovie}
                    skippedMovies={skippedMovies}
                    onUndoSkip={handleUndoSkip}
                    awaitingLastSkipConfirm={awaitingLastSkipConfirm}
                    onConfirmSkipLast={handleConfirmSkipLast}
                    onDeclineSkipLast={handleDeclineSkipLast}
                    disabled={busy || switchingSubset}
                    onOpenDetail={setDetailMovie}
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
              {activePack && activePack.type !== HEAD_TO_HEAD_TYPE && (
                <div className="rank-button-row-fixed inset-x-0 z-20 flex justify-center">
                  <RankButton
                    onClick={handleRank}
                    disabled={busy || switchingSubset || activePack.movies.length < 2}
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {packIntro && <PackIntroOverlay label={packIntro.label} fading={packIntro.fading} />}

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
        <div
          className="fixed inset-0 z-30 bg-black/55"
          onClick={() => setShowSkippedView(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 right-0 z-40 min-h-0 w-[85vw] max-w-[380px] bg-[var(--bg-page)] shadow-[-8px_0_24px_rgba(0,0,0,0.4)] transition-transform duration-200 ${showSkippedView ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <SkippedView
          open={showSkippedView}
          onChange={handleSkippedViewChange}
          onClose={() => setShowSkippedView(false)}
          onOpenDetail={setDetailMovie}
        />
      </aside>
      {showInstructionsModal && (
        <InstructionsModal
          onClose={handleCloseInstructions}
          initialShowOnLoad={initialShowInstructions()}
        />
      )}
      {detailMovie && (
        <MovieDetailModal movie={detailMovie} onClose={() => setDetailMovie(null)} />
      )}
    </div>
  )
}

export default App
