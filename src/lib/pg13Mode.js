// "PG-13 and under" toggle (#193) — composable with every subset (Popular,
// Family, All Movies, every genre/language/country subset, Comic Book), not
// a subset of its own. Mirrors familyMode.js's shape: a plain predicate plus
// a filter helper, shared between the server (rankingService.js) and the
// client (App.jsx/categoryGenerator via api.js) the same way
// isFamilyGenre/selectFamilySubset are.
const PG13_AND_UNDER_RATINGS = ['G', 'PG', 'PG-13']

// The MPAA ratings system launched November 1, 1968 — movies released
// before this predate the concept of a US certification entirely, so a null
// mpaaRating on one of them isn't a signal about content (mainstream
// releases of that era were essentially G/PG-equivalent under the Hays
// Code); it's just an artifact of the rating system not existing yet.
const MPAA_RATINGS_START_YEAR = 1968

// A movie with no US certification (mpaaRating null — TMDb had no US
// release_dates certification for it) is excluded when the toggle is on,
// since there's no way to verify it actually qualifies as PG-13-and-under —
// unless it predates the ratings system, in which case the absence of a
// rating carries no such signal and shouldn't count against it.
export function isPg13OrUnder(movie) {
  if (PG13_AND_UNDER_RATINGS.includes(movie.mpaaRating)) return true
  return movie.mpaaRating == null && movie.year < MPAA_RATINGS_START_YEAR
}

export function selectPg13OrUnder(movies) {
  return movies.filter(isPg13OrUnder)
}
