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

export function selectPopular(movies) {
  return selectTopByVoteCount(movies, POPULAR_POOL_SIZE)
}
