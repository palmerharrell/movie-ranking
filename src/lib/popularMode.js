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

// Marvel/DC movies are excluded here (#180) — their sheer volume (dozens of
// MCU/DCEU entries) was crowding out everything else in this top-N cutoff.
// They're still rankable, just via the dedicated Comic Book subset (#181)
// instead — see genreSubsets.js's 'comicbook' entry, which skips this
// exclusion. All Movies bypasses selectPopular entirely, so it's unaffected
// and stays the one place Marvel/DC still show up outside Comic Book.
export function selectPopular(movies) {
  return selectTopByVoteCount(movies.filter((m) => !isMarvelOrDc(m)), POPULAR_POOL_SIZE)
}
