import { selectTopByVoteCount, POPULAR_POOL_SIZE } from './popularMode.js'

// Coco and Sister Act are real musicals TMDb doesn't tag with the `musical`
// keyword (confirmed live against TMDb's API during planning, #150) — a
// small curated exception, same spirit as NOTABLE_STUDIOS/KEYWORD_LABELS in
// curatedAttributes.js.
const MUSICAL_TMDB_ID_EXCEPTIONS = [354912, 2005]

function hasAllGenres(movie, genres) {
  return genres.every((g) => (movie.genres || []).includes(g))
}

function isMusical(movie) {
  return (movie.keywords || []).includes('musical') || MUSICAL_TMDB_ID_EXCEPTIONS.includes(movie.tmdbId)
}

export const GENRE_SUBSETS = [
  { id: 'comedy', label: 'Comedies', matches: (m) => hasAllGenres(m, ['Comedy']) },
  { id: 'action', label: 'Action', matches: (m) => hasAllGenres(m, ['Action']) },
  { id: 'mystery', label: 'Mysteries', matches: (m) => hasAllGenres(m, ['Mystery']) },
  { id: 'horror', label: 'Horror', matches: (m) => hasAllGenres(m, ['Horror']) },
  { id: 'sci-fi', label: 'Sci-Fi', matches: (m) => hasAllGenres(m, ['Science Fiction']) },
  { id: 'fantasy', label: 'Fantasy', matches: (m) => hasAllGenres(m, ['Fantasy']) },
  { id: 'romance', label: 'Romance', matches: (m) => hasAllGenres(m, ['Romance']) },
  { id: 'rom-com', label: 'Rom-Com', matches: (m) => hasAllGenres(m, ['Romance', 'Comedy']) },
  { id: 'musicals', label: 'Musicals', matches: isMusical },
  { id: 'drama', label: 'Dramas', matches: (m) => hasAllGenres(m, ['Drama']) },
  { id: 'adventure', label: 'Adventure', matches: (m) => hasAllGenres(m, ['Adventure']) },
  { id: 'animation', label: 'Animation', matches: (m) => hasAllGenres(m, ['Animation']) },
  { id: 'thriller', label: 'Thrillers', matches: (m) => hasAllGenres(m, ['Thriller']) },
  { id: 'crime', label: 'Crime', matches: (m) => hasAllGenres(m, ['Crime']) },
  { id: 'french', label: 'French', matches: (m) => m.originalLanguage === 'fr' },
  { id: 'spanish', label: 'Spanish', matches: (m) => m.originalLanguage === 'es' },
  { id: 'italian', label: 'Italian', matches: (m) => m.originalLanguage === 'it' },
]

export const LANGUAGE_SUBSET_IDS = ['french', 'spanish', 'italian']

// Filters to movies matching the subset's own attributes (genre/keyword/
// language) — not by which sources[] tag got a movie into the pool, so a
// Comedy added via personal import still surfaces here if popular enough,
// not only ones fetched via the top-comedy discover source (#150). Then
// caps to the same top-N-by-voteCount used by Popular.
export function selectGenreSubset(movies, subsetId) {
  const config = GENRE_SUBSETS.find((s) => s.id === subsetId)
  if (!config) return movies
  return selectTopByVoteCount(movies.filter(config.matches), POPULAR_POOL_SIZE)
}

// Display label for any genre/language subset id — used by SaveRankingModal/
// ResetRankingModal to build generic copy without a bespoke entry per id.
export function genreSubsetLabel(subsetId) {
  return GENRE_SUBSETS.find((s) => s.id === subsetId)?.label ?? subsetId
}
