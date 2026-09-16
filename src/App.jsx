import { useEffect, useMemo, useRef, useState } from 'react'
import { LeftPanel } from './components/LeftPanel.jsx'
import { RightPanel } from './components/RightPanel.jsx'
import { HeadToHeadPanel } from './components/HeadToHeadPanel.jsx'
import { RankButton } from './components/RankButton.jsx'
import { SubsetPicker } from './components/SubsetPicker.jsx'
import { ResetRankingModal } from './components/ResetRankingModal.jsx'
import { SaveRankingModal } from './components/SaveRankingModal.jsx'
import { ResultsScreen } from './components/ResultsScreen.jsx'
import { LoadRankingView } from './components/LoadRankingView.jsx'
import { SkippedView } from './components/SkippedView.jsx'
import { SearchSuggestModal } from './components/SearchSuggestModal.jsx'
import { BannerMenu } from './components/BannerMenu.jsx'
import { InstructionsModal } from './components/InstructionsModal.jsx'
import { MovieDetailModal } from './components/MovieDetailModal.jsx'
import { PackIntroOverlay } from './components/PackIntroOverlay.jsx'
import { PackChoiceScreen } from './components/PackChoiceScreen.jsx'
import { StartScreen } from './components/StartScreen.jsx'
import { NewRankingScreen } from './components/NewRankingScreen.jsx'
import { ContinueRankingScreen } from './components/ContinueRankingScreen.jsx'
import * as api from './lib/api.js'
import { computeHeatColors } from './lib/rankGradient.js'
import { isFamilyGenre } from './lib/familyMode.js'
import { selectPopular } from './lib/popularMode.js'
import { selectPg13OrUnder } from './lib/pg13Mode.js'
import {
  GENRE_SUBSETS,
  selectGenreSubset,
  isDirectorSubsetId,
  getTopDirectors,
  subsetMoviesLabel,
} from './lib/genreSubsets.js'
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
  // Director subset ids aren't a fixed list (see genreSubsets.js) — a
  // director's top-N standing can change as the pool grows, so this just
  // trusts the stored id's shape rather than re-deriving "was this director
  // still top-15 as of last visit." If they've since fallen out of the
  // list, selectGenreSubset still resolves fine (a smaller/empty pool);
  // there's just no matching entry left in the picker.
  return isDirectorSubsetId(stored) || validIds.includes(stored) ? stored : 'popular'
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
  // The Start screen (#361) gates entry into the app: 'start' shows the
  // Start a New Ranking / Continue choice, 'newRanking' shows the
  // full-screen subset list, 'continueRanking' shows the list of saved
  // rankings to resume, and 'app' is the normal ranking UI below.
  const [screen, setScreen] = useState('start')
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
  // Set once the currently-displayed completed ranking has been saved (via
  // the Results screen's own Save button, or lazily by Share saving first)
  // — null means nothing has been persisted yet for this run (#345 followup:
  // completion no longer auto-saves).
  const [resultsShareSlug, setResultsShareSlug] = useState(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showLoadView, setShowLoadView] = useState(false)
  const [showSkippedView, setShowSkippedView] = useState(false)
  const [showSearchSuggest, setShowSearchSuggest] = useState(false)
  const [showRankingsDrawer, setShowRankingsDrawer] = useState(false)
  const [showInstructionsModal, setShowInstructionsModal] = useState(initialShowInstructions)
  // The movie shown in the big detail card (#222, #223) — tapping/clicking a
  // movie in a pack, the rankings, the skipped list, or a Head to Head
  // card's own info button opens it; null when no detail card is showing.
  const [detailMovie, setDetailMovie] = useState(null)
  // Total unfiltered pool size, shown in the picker's "All (nnnn)" label
  // (#182/#183) — fetched once since it's independent of the active subset.
  const [allMoviesCount, setAllMoviesCount] = useState(null)
  // The Directors picker group (#334) — top directors by movie count across
  // the whole unfiltered pool, computed once alongside allMoviesCount since
  // both need the same unfiltered fetch.
  const [directorSubsets, setDirectorSubsets] = useState([])
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
  const eligibleCount = eligibleMovies.length
  // The footer Skipped tab shows the true, global count of persistently
  // skipped movies (#337) — the same count the Skipped drawer's own list
  // (api.getSkippedMovies) reflects, since skip state is a fact about the
  // browser, not about whichever subset happens to be active (see **Skip
  // ("Haven't Seen")**). A direct synchronous read, so it stays correct on
  // every render without a separate fetch/effect.
  const skippedCount = api.getSkippedCount()
  const isFamily = subset === 'family'
  const isPopular = subset === 'popular'
  const activeGenre = GENRE_SUBSETS.some((g) => g.id === subset) || isDirectorSubsetId(subset) ? subset : null
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

  // Shows the Results screen once the currently-visible pool transitions
  // into "every movie ranked at least once" — not on every subsequent Rank
  // click while it stays there. Completion no longer auto-saves anything
  // (the user saves explicitly from the Results screen, or Share saves
  // lazily on first use — see handleShareResults/handleSaveResults below);
  // this just surfaces the screen.
  function noteMoviesUpdate(updatedMovies) {
    const visibleMovies = computeVisibleMovies(updatedMovies)
    setMovies(visibleMovies)
    const fullyRanked = isFullyRanked(visibleMovies)
    if (fullyRanked && !wasFullyRanked.current) {
      setShowResultsScreen(true)
    }
    wasFullyRanked.current = fullyRanked
  }

  function currentRankingOptions() {
    return { family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13, subset }
  }

  // Skip paths (#253) patch the already-scoped `movies` state directly
  // rather than refetching through noteMoviesUpdate, since a skip is a pure
  // client-side local-state change with no new server/local-store data to
  // reconcile. But that means, unlike a "Rank ->"/Head to Head submission,
  // they never checked whether the patch just completed the visible pool —
  // e.g. skipping ("haven't seen") the very last remaining un-ranked movie
  // removes it from the ranked-progress denominator (see **Progress
  // tracking**) and can *by itself* make every remaining movie satisfy
  // "ranked at least once," which per **Saved rankings** should surface the
  // Results screen immediately, exactly like ranking it would. Mirrors
  // noteMoviesUpdate's own transition check (only fire on the false->true
  // edge) so this doesn't re-open the Results screen on every subsequent
  // skip once the pool is already complete.
  function applyMoviesPatch(updater) {
    setMovies((prev) => {
      if (!prev) return prev
      const updated = updater(prev)
      const fullyRanked = isFullyRanked(updated)
      if (fullyRanked && !wasFullyRanked.current) {
        setShowResultsScreen(true)
      }
      wasFullyRanked.current = fullyRanked
      return updated
    })
  }

  // The live Results screen's Share button: if nothing's been saved yet for
  // this run, save it first (under a generated default name) to get a share
  // slug, then copy the link. ResultsScreen's own handleShareClick already
  // wraps this in try/catch and shows an inline error on failure.
  async function handleShareResults() {
    let slug = resultsShareSlug
    if (!slug) {
      const saved = await api.saveRanking(generateRankingName(subset, effectivePg13), currentRankingOptions())
      slug = saved.shareSlug
      setResultsShareSlug(slug)
    }
    await navigator.clipboard.writeText(buildShareUrl(slug))
  }

  // The Results screen's Save button (typed name) — persists a snapshot
  // without disturbing local ranking state, so the user can keep refining or
  // viewing afterward. Errors are left to the modal's own inline handling.
  async function handleSaveResults(name) {
    const saved = await api.saveRanking(name, currentRankingOptions())
    setResultsShareSlug(saved.shareSlug)
    setShowSaveModal(false)
  }

  // "Refine Ranking" — re-ranks every non-skipped movie in scope one more
  // time by resetting timesRanked back to 0 while keeping eloRating, so the
  // new pass refines from current standings instead of starting at 1000
  // again. Mirrors handleResetRanking's shape below, just with a lighter
  // reset.
  async function handleRefineRanking() {
    setShowResultsScreen(false)
    setResultsShareSlug(null)
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    wasFullyRanked.current = false
    try {
      await api.refineRanking(currentRankingOptions())
      const [updatedMovies, nextTurn] = await Promise.all([
        api.getMovies({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
        api.getNextTurn({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 }),
      ])
      noteMoviesUpdate(updatedMovies)
      setTurn(nextTurn)
    } catch (err) {
      setMovies(null)
      setTurn(null)
      setError(err.message)
    }
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
    api.getMovies().then((allMovies) => {
      setAllMoviesCount(allMovies.length)
      setDirectorSubsets(getTopDirectors(allMovies))
    })
  }, [])

  // #247: the Rankings drawer and Skipped view are both fixed-position
  // overlays, which doesn't stop the page underneath from scrolling on
  // touch devices — locking body scroll while either is open keeps the
  // background still.
  useEffect(() => {
    if (!showRankingsDrawer && !showSkippedView) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showRankingsDrawer, showSkippedView])

  // #342: the Rankings and Skipped drawers are mutually exclusive — opening
  // one closes the other, rather than letting both slide out at once — and
  // each footer tab/menu item toggles its own drawer instead of only ever
  // opening it, so clicking a tab while its drawer is already open closes it.
  function handleToggleRankingsDrawer() {
    setShowRankingsDrawer((open) => {
      if (!open) setShowSkippedView(false)
      return !open
    })
  }

  function handleToggleSkippedView() {
    setShowSkippedView((open) => {
      if (!open) setShowRankingsDrawer(false)
      return !open
    })
  }

  // Announces a Head to Head / Top 10 Tough Choice pack (#298) with a
  // screen-filling "<label>!" overlay for a beat before it's shown — fires
  // whenever `activePack` itself changes (a fresh reference every time a
  // pack is promoted to active, whether via "Rank ->", a pack-choice pick,
  // or a subset switch) and the newly-active pack is one of those two
  // types. Distinguishing "Head to Head" from "Top 10 Tough Choice" is just
  // a matter of using the pack's own label — both share HEAD_TO_HEAD_TYPE.
  // #253: a "Rank ->"/Head to Head submission that both completes the pool
  // *and* rolls a Head to Head/Tough Choice pack as the already-generated
  // next turn (see **Saved rankings**'s "next pack ... simply becomes
  // visible again") would otherwise fire this effect purely off the new
  // `activePack` reference, popping the "Head to Head!" announcement
  // (z-index 60) on top of the just-triggered Results screen (z-index 50)
  // the same instant it appears. Gating on `showResultsScreen` suppresses
  // the intro while that screen is up; re-including it in the dependency
  // array means dismissing the Results screen (with the same Head to
  // Head/Tough Choice pack still active underneath) re-runs this effect and
  // shows the announcement then instead — so it's deferred, not skipped.
  useEffect(() => {
    if (!activePack || activePack.type !== HEAD_TO_HEAD_TYPE || showResultsScreen) {
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
  }, [activePack, showResultsScreen])

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
    if (screen !== 'app') return
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    loadSubset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subset, pg13, screen])

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
    // #355: also reachable from a Rankings-panel row, for a movie that
    // isn't part of the active pack (or when there's no active pack at
    // all, e.g. during Head to Head/pack-choice) — there's no pack state
    // to reconcile in that case, so just mark it skipped directly rather
    // than running it through the pack-aware logic below (which assumes
    // the movie is one of activePack.movies).
    if (!activePack?.movies?.some((m) => m.id === movieId)) {
      api.markSkipped(movieId)
      applyMoviesPatch((prev) =>
        prev.map((m) => (m.id === movieId ? { ...m, skipped: true, eloRating: 1000, timesRanked: 0 } : m))
      )
      return
    }
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
    applyMoviesPatch((prev) =>
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

  // A movie added via Search & Suggest (#243) lands server-side immediately
  // (see server/suggestionService.js), but this browser's own `movies` state
  // won't reflect it until re-fetched — best-effort, since the new movie
  // will show up next time movies refetch anyway (e.g. the next "Rank →")
  // even if this particular refresh fails.
  function handleSuggestionAdded() {
    api.getMovies(currentRankingOptions()).then(noteMoviesUpdate).catch(() => {})
  }

  // "Yes" on the inline "skip this one too?" prompt (#156): skip the last
  // remaining movie the same way any other tile-skip does, then discard the
  // now-empty pack and advance, mirroring the old auto-discard behavior.
  function handleConfirmSkipLast() {
    const lastMovie = activePack.movies[0]
    setAwaitingLastSkipConfirm(false)
    api.markSkipped(lastMovie.id)
    applyMoviesPatch((prev) =>
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

  // Closing the Results screen with no explicit action (the × button) just
  // hides it — nothing needs to reset or refetch. The pool is already fully
  // ranked and Elo state is untouched, and handleRank's own turn generation
  // already left a valid next pack sitting in `turn` state, so it simply
  // becomes visible again underneath.
  function handleResultsClose() {
    setShowResultsScreen(false)
    setResultsShareSlug(null)
  }

  async function handleResetRanking() {
    // Let a failure here propagate to the modal, which shows it inline.
    await api.resetRanking({ family: isFamily, popular: isPopular, genre: activeGenre, pg13: effectivePg13 })
    setShowResetModal(false)
    // Reachable from the Results screen's own "Start Over" button as well as
    // the ☰ menu — clear results-screen state too (harmless no-ops when
    // triggered from the menu, where these are already false/null).
    setShowResultsScreen(false)
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
      // The reset already committed (local state cleared), so drop the
      // now-stale board rather than silently leaving it displayed.
      setMovies(null)
      setTurn(null)
      setError(err.message)
    }
  }

  // "Start a New Ranking" (#361): picking a subset from the full-screen list
  // just sets it active and enters the app, same as picking it from the
  // banner's own subset pill later would — whatever local progress already
  // exists for that subset (if any) picks up where it left off.
  function handlePickNewSubset(id) {
    setSubset(id)
    setScreen('app')
  }

  // "Continue" a saved ranking (#361) — imports the snapshot's own
  // eloRating for its movies into local state (api.continueSavedRanking,
  // resetting timesRanked to 0) and switches into that snapshot's own
  // subset/pg13, the same reset-then-refetch shape as Refine Ranking above
  // but seeded from the snapshot instead of whatever's currently active.
  // Left to throw on failure — ContinueRankingScreen's own handler shows the
  // error inline and keeps the list open rather than entering the app.
  async function handleContinueRanking(ranking) {
    await api.continueSavedRanking(ranking.id)
    setShowResultsScreen(false)
    setResultsShareSlug(null)
    setSkippedMovies([])
    setAwaitingLastSkipConfirm(false)
    wasFullyRanked.current = false
    setSubset(ranking.subset)
    setPg13(!!ranking.pg13)
    setScreen('app')
  }

  // "Load Ranking" from the in-app ☰ menu (#379) — LoadRankingView only ever
  // lists snapshots scoped to the *currently active* subset+pg13 (unlike
  // Continue's unscoped list above), so this shares handleContinueRanking's
  // import step (api.continueSavedRanking) but not its subset/pg13/screen
  // switch, since those are already correct. Switching to the same subset/
  // pg13 values wouldn't retrigger the subset-switch effect (its dependency
  // array wouldn't change), so this fetches the fresh movies/turn directly
  // instead — the same reset-then-refetch shape handleRefineRanking above
  // uses, just seeded from the snapshot's ratings instead of whatever's
  // currently active locally. Like Refine, this lands on a live pack for a
  // fresh full pass rather than immediately reopening the Results screen —
  // the import resets timesRanked to 0, so noteMoviesUpdate's own
  // fully-ranked check naturally won't fire again until that pass completes.
  // Left to throw on failure — LoadRankingView's own handler shows the error
  // inline and keeps the list open rather than dismissing it.
  async function handleLoadRanking(ranking) {
    await api.continueSavedRanking(ranking.id)
    setShowLoadView(false)
    setShowResultsScreen(false)
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
      setMovies(null)
      setTurn(null)
      setError(err.message)
    }
  }

  // Hot (top-ranked) -> cold (bottom-ranked) gradient colors (#352), keyed
  // by movie id so the Rankings panel and pack tiles color the same movie
  // identically. Scoped to the same non-skipped pool the Rankings panel
  // itself ranks by, so the gradient's "top" and "bottom" match what's
  // actually visible. Computed unconditionally, above every early-return
  // screen branch below, to satisfy the rules of hooks.
  const heatColors = useMemo(
    () => computeHeatColors(movies ? movies.filter((m) => !m.skipped) : []),
    [movies],
  )

  if (screen === 'start') {
    return (
      <div
        data-theme="popular"
        data-color-mode={colorMode}
        className="app-shell flex flex-col overflow-hidden"
        style={{ '--film-reel-bg-url': `url(${filmReelBg})` }}
      >
        <StartScreen onStartNew={() => setScreen('newRanking')} onContinue={() => setScreen('continueRanking')} />
      </div>
    )
  }

  if (screen === 'newRanking') {
    return (
      <div
        data-theme="popular"
        data-color-mode={colorMode}
        className="app-shell flex flex-col overflow-hidden"
        style={{ '--film-reel-bg-url': `url(${filmReelBg})` }}
      >
        <NewRankingScreen
          allMoviesCount={allMoviesCount}
          directorSubsets={directorSubsets}
          onPick={handlePickNewSubset}
          onBack={() => setScreen('start')}
        />
      </div>
    )
  }

  if (screen === 'continueRanking') {
    return (
      <div
        data-theme="popular"
        data-color-mode={colorMode}
        className="app-shell flex flex-col overflow-hidden"
        style={{ '--film-reel-bg-url': `url(${filmReelBg})` }}
      >
        <ContinueRankingScreen onSelect={handleContinueRanking} onBack={() => setScreen('start')} />
      </div>
    )
  }

  return (
    <div
      data-theme="popular"
      data-color-mode={colorMode}
      className="app-shell flex flex-col overflow-hidden"
      style={{ '--film-reel-bg-url': `url(${filmReelBg})` }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1120px] min-h-0 flex-col xl:max-w-[1480px]">
        <header className="banner shrink-0 px-2.5 py-1.5 md:px-6 md:py-3">
          <div className="app-header-row">
            <img
              src={`${import.meta.env.BASE_URL}${colorMode === 'light' ? 'favicon-light.svg' : 'favicon.svg'}`}
              alt=""
              aria-hidden="true"
              className="app-header-logo h-[40px] w-[40px] shrink-0 md:h-[48px] md:w-[48px]"
            />
            <SubsetPicker
              subset={subset}
              onChange={setSubset}
              allMoviesCount={allMoviesCount}
              directorSubsets={directorSubsets}
            />
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget.blur()
                setColorMode((mode) => (mode === 'dark' ? 'light' : 'dark'))
              }}
              className="theme-toggle-button"
              aria-label={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {colorMode === 'dark' ? '☀️' : '🌙'}
            </button>
            <BannerMenu
              onRankings={handleToggleRankingsDrawer}
              onLoadRanking={() => setShowLoadView(true)}
              onSkipped={handleToggleSkippedView}
              onSearchSuggest={() => setShowSearchSuggest(true)}
              onInstructions={() => setShowInstructionsModal(true)}
              pg13Checked={effectivePg13}
              pg13Disabled={isFamily}
              pg13Title={isFamily ? 'Family always applies the PG-13 & Under filter' : undefined}
              onPg13Change={setPg13}
              onReset={() => setShowResetModal(true)}
              showReset={rankedCount > 0}
            />
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

        <div className="relative grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[340px_1fr]">
          {/* Rankings/Skipped drawers (responsive-redesign): anchored with
              `absolute inset-y-0` to *this* body element (the flex row
              between header and footer), not the viewport — so on a dvh
              shell they stop above the footer instead of covering it. */}
          {showRankingsDrawer && (
            <div
              className="absolute inset-0 z-30 bg-black/55 md:hidden"
              onClick={() => setShowRankingsDrawer(false)}
            />
          )}

          <aside
            className={`rankings-col absolute inset-y-0 left-0 z-40 min-h-0 w-[85vw] max-w-[340px] bg-[var(--bg-page)] shadow-[8px_0_24px_rgba(0,0,0,0.4)] transition-transform duration-200 md:static md:z-auto md:w-auto md:max-w-none md:translate-x-0 md:bg-transparent md:shadow-none ${showRankingsDrawer ? 'translate-x-0' : '-translate-x-full'}`}
            style={{ padding: '22px 8px 22px 22px' }}
          >
            <div className="mb-2 flex justify-end md:hidden">
              <button
                type="button"
                onClick={() => setShowRankingsDrawer(false)}
                className="modal-close"
                aria-label="Close rankings"
              >
                ×
              </button>
            </div>
            {movies ? (
              <LeftPanel
                movies={movies}
                subset={subset}
                heatColors={heatColors}
                onOpenDetail={setDetailMovie}
                onSkip={handleSkipMovie}
                open={showRankingsDrawer}
              />
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-low)' }}>
                Loading…
              </p>
            )}
          </aside>

          {showSkippedView && (
            <div
              className="absolute inset-0 z-30 bg-black/55"
              onClick={() => setShowSkippedView(false)}
            />
          )}

          <aside
            className={`absolute inset-y-0 right-0 z-40 min-h-0 w-[85vw] max-w-[380px] bg-[var(--bg-page)] shadow-[-8px_0_24px_rgba(0,0,0,0.4)] transition-transform duration-200 ${showSkippedView ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <SkippedView
              open={showSkippedView}
              onChange={handleSkippedViewChange}
              onClose={() => setShowSkippedView(false)}
              onOpenDetail={setDetailMovie}
            />
          </aside>

          <main
            className="flex min-h-0 flex-1 flex-col items-center overflow-hidden"
            style={{ padding: 'var(--main-pad)' }}
          >
            <div className="mx-auto flex w-full min-h-0 max-w-xl flex-1 flex-col">
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
                  />
                ) : (
                  <RightPanel
                    category={activePack}
                    heatColors={heatColors}
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
            </div>
          </main>
        </div>

        {/* Footer: a sticky bar in normal flow (responsive-redesign) —
            replaces the old three independently `position: fixed` elements
            (Rank button, both edge tabs), which measured a viewport taller
            than what Safari actually shows. The center cell keeps its `1fr`
            column even with no Rank button (Head to Head/pack choice), so
            the two tabs never shift between packs. */}
        <footer className="app-footer shrink-0">
          {movies ? (
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget.blur()
                handleToggleRankingsDrawer()
              }}
              className="footer-tab md:invisible"
              aria-label={`${showRankingsDrawer ? 'Close' : 'Open'} rankings — ${rankedCount} of ${eligibleCount} ranked`}
            >
              Current Ranking
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          {activePack && activePack.type !== HEAD_TO_HEAD_TYPE ? (
            <RankButton
              onClick={handleRank}
              disabled={busy || switchingSubset || activePack.movies.length < 2}
            />
          ) : (
            <span aria-hidden="true" />
          )}

          {movies ? (
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget.blur()
                handleToggleSkippedView()
              }}
              className="footer-tab"
              aria-label={`${showSkippedView ? 'Close' : 'Open'} skipped movies — ${skippedCount} skipped`}
            >
              <span className="footer-tab-count">{skippedCount}</span>
              Skipped
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
        </footer>
      </div>

      {packIntro && <PackIntroOverlay label={packIntro.label} fading={packIntro.fading} />}

      {showResultsScreen && movies && (
        <ResultsScreen
          // Skipped ("haven't seen") movies are excluded from the ranked
          // pool entirely (#136) and from what actually got saved
          // (api.saveRanking filters them out before persisting) — the
          // live Results screen must show the same set, not the raw
          // `movies` state, which still carries skipped entries for the
          // Rankings/Skipped drawers (#339).
          movies={eligibleMovies}
          scopeLabel={subsetMoviesLabel(subset, effectivePg13)}
          onDismiss={handleResultsClose}
          onShare={handleShareResults}
          onRefine={handleRefineRanking}
          onSave={() => setShowSaveModal(true)}
          onStartOver={() => setShowResetModal(true)}
        />
      )}
      {showSaveModal && (
        <SaveRankingModal
          defaultName={generateRankingName(subset, effectivePg13)}
          onConfirm={handleSaveResults}
          onDismiss={() => setShowSaveModal(false)}
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
        <LoadRankingView
          subset={subset}
          pg13={effectivePg13}
          onSelect={handleLoadRanking}
          onClose={() => setShowLoadView(false)}
        />
      )}
      {showSearchSuggest && (
        <SearchSuggestModal
          onClose={() => setShowSearchSuggest(false)}
          onAdded={handleSuggestionAdded}
          onOpenDetail={setDetailMovie}
        />
      )}
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
