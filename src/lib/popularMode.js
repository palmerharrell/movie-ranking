import { isMarvelOrDc } from './comicBookMovies.js'

// Tune later — not a hard requirement from #104, just a starting cutoff.
export const POPULAR_POOL_SIZE = 300

// Top-N by TMDb voteCount (a stable "how mainstream is this" proxy, unlike
// TMDb's own day-to-day popularity score). A movie with no confirmed
// voteCount sorts last, same as being excluded in practice. Shared with
// genreSubsets.js's per-genre/language/keyword top-N cutoff (#150).
export function selectTopByVoteCount(movies, n) {
  return [...movies]
    .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
    .slice(0, n)
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
  const sorted = [...movies].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
  const isClassic = (m) => m.year != null && m.year < cutoffYear
  const top = sorted.slice(0, n)

  const needed = quota - top.filter(isClassic).length
  if (needed <= 0) return top

  const topSet = new Set(top)
  const extraClassics = sorted.filter((m) => isClassic(m) && !topSet.has(m)).slice(0, needed)
  if (extraClassics.length === 0) return top

  const nonClassicsInTop = top.filter((m) => !isClassic(m))
  const dropCount = Math.min(extraClassics.length, nonClassicsInTop.length)
  const toDrop = new Set(nonClassicsInTop.slice(nonClassicsInTop.length - dropCount))

  return [...top.filter((m) => !toDrop.has(m)), ...extraClassics].sort(
    (a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0),
  )
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
