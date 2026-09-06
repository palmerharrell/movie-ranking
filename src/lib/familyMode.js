import { selectPopular } from './popularMode.js'

const FAMILY_GENRE = 'Family'

// TMDb's own "Family" genre tag (#152) — a curation signal, not a safety
// guarantee. This replaces the old MPAA-rating-based "Family (PG-13)"
// subset: a Family-genre movie can still carry any mpaaRating (including
// PG-13, or in principle something TMDb miscategorizes) — there's no safety
// floor layered underneath this filter.
export function isFamilyGenre(movie) {
  return (movie.genres || []).includes(FAMILY_GENRE)
}

// Filters to Family-genre movies, then caps to the same top-N-by-voteCount
// used by Popular and the other genre/language subsets (#150's pattern).
export function selectFamilySubset(movies) {
  return selectPopular(movies.filter(isFamilyGenre))
}

// Mirrors genreSubsets.js's genreSubsetExclusions (#160) — every movie in
// the Family subset already carries the Family genre by construction, so a
// "Family Movies" category (or a paired "90s Family Movies") would be
// tautological while this subset is active. Family isn't itself a
// GENRE_SUBSETS entry (its own picker/theme predates that pattern), so its
// exclusion is kept alongside its filter here instead.
export function familySubsetExclusions() {
  return [{ type: 'genre', value: FAMILY_GENRE }]
}
