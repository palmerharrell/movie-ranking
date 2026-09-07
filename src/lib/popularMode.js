import { isMarvelOrDc } from './comicBookMovies.js'

// Tune later — not a hard requirement from #104, just a starting cutoff.
export const POPULAR_POOL_SIZE = 300

// Sorts by voteCount descending, then by id ascending as an explicit,
// deterministic tiebreak. Movies tied on voteCount (common — many pool
// entries have 0/null) must not fall back to incidental array order:
// the client derives its pool from an unfiltered `GET /api/movies` while
// the server filters from its own internal list, so the two sides see
// different starting array orders for the same movies. Without an
// explicit tiebreak, Array.sort's stability made the two sides pick
// different top-N sets at the tied-voteCount boundary, which could
// permanently exclude a movie from pack generation while still counting
// it as required for completion (#230).
function byVoteCountThenId(a, b) {
  const voteDiff = (b.voteCount ?? 0) - (a.voteCount ?? 0)
  if (voteDiff !== 0) return voteDiff
  return String(a.id).localeCompare(String(b.id))
}

// Top-N by TMDb voteCount (a stable "how mainstream is this" proxy, unlike
// TMDb's own day-to-day popularity score). A movie with no confirmed
// voteCount sorts last, same as being excluded in practice. Shared with
// genreSubsets.js's per-genre/language/keyword top-N cutoff (#150).
export function selectTopByVoteCount(movies, n) {
  return [...movies].sort(byVoteCountThenId).slice(0, n)
}

// A movie counts as "classic era" for the quota below if released before
// this year — chosen as a round cutoff separating pre-blockbuster-era
// releases (which TMDb's mostly-modern userbase rates far less) from
// everything since (#203).
export const CLASSIC_ERA_CUTOFF_YEAR = 1980

// Minimum number of a niche subset's capped slots reserved for classic-era
// movies (#203) — see selectTopByVoteCountWithEraQuota below.
export const CLASSIC_ERA_QUOTA = 20

// Same top-N-by-voteCount cutoff as selectTopByVoteCount, but with a floor:
// at least `quota` of the `n` slots go to the best-by-voteCount movies
// released before `cutoffYear`, topped up from outside the natural top-N
// only if the natural ranking doesn't already clear that floor. A flat
// voteCount cutoff systematically favors modern/mainstream titles — TMDb
// engagement skews heavily toward recent, streamed releases — so a niche
// subset's classics can get crowded out purely by volume of modern entries
// sharing the genre/keyword, independent of the subset's overall size
// (#203, found via the Musicals subset missing golden-age titles). This is
// a floor, not a fixed partition: a subset whose natural top-N already
// meets the quota (e.g. Italian, whose classics are popular enough to rank
// highly on their own) is returned unchanged.
export function selectTopByVoteCountWithEraQuota(movies, n, quota, cutoffYear) {
  const isClassic = (m) => m.year != null && m.year < cutoffYear
  return selectTopByVoteCountWithQuotas(movies, n, [{ matches: isClassic, quota }])
}

// Source ids (see data/sources/*.source.json) treated as "canonical" for the
// quota below — hand-curated critical/preservation lists, as opposed to the
// TMDb-discover-based `top-<genre>`/`top-grossing-*` sources (already
// voteCount-ranked, so a floor for them would be redundant) or
// `letterboxd-top250-*`/`personal` (community/individual taste, not a
// critical or historical-significance signal) (#207).
export const CANONICAL_SOURCE_IDS = [
  'afi-top-100',
  'afi-top10-animation',
  'afi-top10-courtroom-drama',
  'afi-top10-epic',
  'afi-top10-fantasy',
  'afi-top10-gangster',
  'afi-top10-mystery',
  'afi-top10-romantic-comedy',
  'afi-top10-science-fiction',
  'afi-top10-sports',
  'afi-top10-western',
  'afi-greatest-musicals',
  'ebert-great-movies',
  'sight-and-sound-2022',
  'national-film-registry',
  '1001-movies',
  'classic-musicals',
]

// A movie needs at least this many TMDb votes to count toward the canonical
// quota below, even if it's from a canonical source — the National Film
// Registry in particular preserves home movies, student films, and raw
// footage collections (e.g. "Cab Calloway Home Movies", "Navajo Film
// Themselves") alongside actual narrative features; a handful of TMDb
// votes is enough to tell an obscure-but-real classic from preservation
// ephemera almost nobody has "seen" in the way this app's ranking assumes
// (#207).
export const CANONICAL_MIN_VOTE_COUNT = 25

// Minimum number of a niche subset's capped slots reserved for
// canonical-source movies (#207) — see selectTopByVoteCountWithQuotas below.
export const CANONICAL_QUOTA = 20

export function isCanonicalSourced(movie) {
  return (
    (movie.voteCount ?? 0) >= CANONICAL_MIN_VOTE_COUNT &&
    (movie.sources || []).some((s) => CANONICAL_SOURCE_IDS.includes(s))
  )
}

// Generalizes selectTopByVoteCountWithEraQuota (#203) to any number of
// independent floors. Each floor is `{ matches, quota }`: at least `quota`
// of the `n` slots go to the best-by-voteCount movies satisfying `matches`,
// topped up from outside the natural top-N only if the natural ranking
// doesn't already clear that floor. Floors are filled in order, and a movie
// already kept to satisfy one floor is never evicted to make room for
// another (#207) — otherwise satisfying a later floor could silently undo
// an earlier one (e.g. bumping a classic-era movie added for
// CLASSIC_ERA_QUOTA to make room for a canonical-source one). This is a
// set of floors, not a fixed partition: a subset whose natural top-N
// already meets every floor is returned unchanged.
export function selectTopByVoteCountWithQuotas(movies, n, floors) {
  const sorted = [...movies].sort(byVoteCountThenId)
  let selected = sorted.slice(0, n)

  for (const { matches, quota } of floors) {
    const needed = quota - selected.filter(matches).length
    if (needed <= 0) continue

    const selectedSet = new Set(selected)
    const extras = sorted.filter((m) => matches(m) && !selectedSet.has(m)).slice(0, needed)
    if (extras.length === 0) continue

    // Never evict a movie already satisfying any floor (this one or one
    // processed earlier) — only the surplus, unprotected entries make room.
    const protectedSet = new Set(selected.filter((m) => floors.some((f) => f.matches(m))))
    const evictable = selected.filter((m) => !protectedSet.has(m))
    const dropCount = Math.min(extras.length, evictable.length)
    const toDrop = new Set(evictable.slice(evictable.length - dropCount))

    selected = [...selected.filter((m) => !toDrop.has(m)), ...extras.slice(0, dropCount)]
  }

  return selected.sort(byVoteCountThenId)
}

// Marvel/DC movies are excluded here (#180) — their sheer volume (dozens of
// MCU/DCEU entries) was crowding out everything else in this top-N cutoff.
// They're still rankable, just via the dedicated Comic Book subset (#181)
// instead — see genreSubsets.js's 'comicbook' entry, which skips this
// exclusion. All Movies bypasses selectPopular entirely, so it's unaffected
// and stays the one place Marvel/DC still show up outside Comic Book.
export function selectPopular(movies) {
  return selectTopByVoteCount(movies.filter((m) => !isMarvelOrDc(m)), POPULAR_POOL_SIZE)
}
