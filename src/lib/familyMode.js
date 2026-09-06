import { selectPopular } from './popularMode.js'

// TMDb's own "Family" genre tag (#152) — a curation signal, not a safety
// guarantee. This replaces the old MPAA-rating-based "Family (PG-13)"
// subset: a Family-genre movie can still carry any mpaaRating (including
// PG-13, or in principle something TMDb miscategorizes) — there's no safety
// floor layered underneath this filter.
export function isFamilyGenre(movie) {
  return (movie.genres || []).includes('Family')
}

// Filters to Family-genre movies, then caps to the same top-N-by-voteCount
// used by Popular and the other genre/language subsets (#150's pattern).
export function selectFamilySubset(movies) {
  return selectPopular(movies.filter(isFamilyGenre))
}
