export const FAMILY_SAFE_RATINGS = ['G', 'PG', 'PG-13']

// A movie with no confirmed US certification is excluded rather than assumed safe.
export function isFamilySafe(movie) {
  return FAMILY_SAFE_RATINGS.includes(movie.mpaaRating)
}
