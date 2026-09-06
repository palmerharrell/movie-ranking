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

// Each entry's `genres`/`language`/`keyword` fields double as the subset's
// own defining attribute(s) — used both to build `matches` below and (via
// `genreSubsetExclusions`) to tell categoryGenerator.js which attribute
// value(s) would be tautological to build a category on while this subset
// is already active (#160), e.g. no "Science Fiction Movies" category while
// the Sci-Fi subset is selected. A subset with an explicit `matches`
// override (Musicals) still declares its defining `keyword` for that
// purpose even though matching itself is more involved than a plain
// attribute-value check.
export const GENRE_SUBSETS = [
  { id: 'comedy', label: 'Comedies', genres: ['Comedy'] },
  { id: 'action', label: 'Action', genres: ['Action'] },
  { id: 'mystery', label: 'Mysteries', genres: ['Mystery'] },
  { id: 'horror', label: 'Horror', genres: ['Horror'] },
  { id: 'sci-fi', label: 'Sci-Fi', genres: ['Science Fiction'] },
  { id: 'fantasy', label: 'Fantasy', genres: ['Fantasy'] },
  { id: 'romance', label: 'Romance', genres: ['Romance'] },
  { id: 'rom-com', label: 'Rom-Com', genres: ['Romance', 'Comedy'] },
  { id: 'musicals', label: 'Musicals', matches: isMusical, keyword: 'musical' },
  { id: 'drama', label: 'Dramas', genres: ['Drama'] },
  { id: 'adventure', label: 'Adventure', genres: ['Adventure'] },
  { id: 'animation', label: 'Animation', genres: ['Animation'] },
  { id: 'thriller', label: 'Thrillers', genres: ['Thriller'] },
  { id: 'crime', label: 'Crime', genres: ['Crime'] },
  { id: 'french', label: 'French', language: 'fr' },
  { id: 'spanish', label: 'Spanish', language: 'es' },
  { id: 'italian', label: 'Italian', language: 'it' },
].map((config) => ({
  ...config,
  matches:
    config.matches ??
    ((m) =>
      config.genres ? hasAllGenres(m, config.genres) : m.originalLanguage === config.language),
}))

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

// The category-generator attribute type/value pair(s) that would be
// tautological to build a category on while this subset is active (#160) —
// every movie in the subset's pool already matches it by construction, so
// e.g. a "Science Fiction Movies" category (or "80s Sci-Fi Movies" pairing)
// conveys no information while the Sci-Fi subset is selected. Returns []
// for unknown/non-genre subset ids (Popular/Family/All Movies have no
// defining attribute to exclude).
export function genreSubsetExclusions(subsetId) {
  const config = GENRE_SUBSETS.find((s) => s.id === subsetId)
  if (!config) return []
  const exclusions = []
  if (config.genres) exclusions.push(...config.genres.map((genre) => ({ type: 'genre', value: genre })))
  if (config.language) exclusions.push({ type: 'language', value: config.language })
  if (config.keyword) exclusions.push({ type: 'keyword', value: config.keyword })
  return exclusions
}
