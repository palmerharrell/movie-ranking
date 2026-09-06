// "PG-13 and under" toggle (#193) — composable with every subset (Popular,
// Family, All Movies, every genre/language/country subset, Comic Book), not
// a subset of its own. Mirrors familyMode.js's shape: a plain predicate plus
// a filter helper, shared between the server (rankingService.js) and the
// client (App.jsx/categoryGenerator via api.js) the same way
// isFamilyGenre/selectFamilySubset are.
const PG13_AND_UNDER_RATINGS = ['G', 'PG', 'PG-13']

// A movie with no US certification (mpaaRating null — TMDb had no US
// release_dates certification for it) is excluded when the toggle is on:
// there's no way to verify it actually qualifies as PG-13-and-under.
export function isPg13OrUnder(movie) {
  return PG13_AND_UNDER_RATINGS.includes(movie.mpaaRating)
}

export function selectPg13OrUnder(movies) {
  return movies.filter(isPg13OrUnder)
}
