import { selectTopByVoteCount } from './popularMode.js'
import { isComicBook, isMarvelOrDc } from './comicBookMovies.js'

// Tune later — not a hard requirement from #165, just a starting cutoff.
// Smaller than POPULAR_POOL_SIZE: niche genre/language/country subsets don't
// have as much depth of genuinely popular titles as Popular/Family/All
// Movies do, so sharing the same 300-movie cap left a long tail of obscure
// matches users ended up skipping en masse (#165, e.g. nearly a third of the
// Sci-Fi subset).
export const GENRE_SUBSET_POOL_SIZE = 100

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

// "British" isn't derivable from genres[]/originalLanguage the way the
// other subsets below are — it's TMDb's production_countries (#151),
// captured separately since a movie's country of production is a distinct
// fact from its original language (many British films are in English).
function isBritish(movie) {
  return (movie.productionCountries || []).includes('GB')
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
  { id: 'british', label: 'British', matches: isBritish, country: 'GB' },
  // The only subset that includes Marvel/DC movies (#181) — every other
  // subset below excludes them via selectGenreSubset/selectPopular (#180).
  // Broader than isMarvelOrDc: TMDb's `superhero` keyword folds in other
  // comic adaptations (Hellboy, Kick-Ass, etc.) too, per #181's "other
  // comic book movies are allowed here too."
  { id: 'comicbook', label: 'Comic Book', matches: isComicBook, keyword: 'superhero' },
].map((config) => ({
  ...config,
  matches:
    config.matches ??
    ((m) =>
      config.genres ? hasAllGenres(m, config.genres) : m.originalLanguage === config.language),
}))

export const LANGUAGE_SUBSET_IDS = ['french', 'spanish', 'italian']

export const COUNTRY_SUBSET_IDS = ['british']

// Filters to movies matching the subset's own attributes (genre/keyword/
// language) — not by which sources[] tag got a movie into the pool, so a
// Comedy added via personal import still surfaces here if popular enough,
// not only ones fetched via the top-comedy discover source (#150). Then
// caps to GENRE_SUBSET_POOL_SIZE — smaller than Popular's cap since these
// niche subsets run shallower on genuinely popular titles (#165). Every
// subset except Comic Book itself also excludes Marvel/DC movies (#180) —
// Comic Book is the one place they're still rankable (#181).
export function selectGenreSubset(movies, subsetId) {
  const config = GENRE_SUBSETS.find((s) => s.id === subsetId)
  if (!config) return movies
  const matched = movies.filter(config.matches)
  const scoped = subsetId === 'comicbook' ? matched : matched.filter((m) => !isMarvelOrDc(m))
  return selectTopByVoteCount(scoped, GENRE_SUBSET_POOL_SIZE)
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
  // No 'country' attribute type exists in categoryGenerator.js yet, so this
  // is inert today — kept so British doesn't silently reintroduce the #160
  // tautology bug if a country-based category attribute is ever added.
  if (config.country) exclusions.push({ type: 'country', value: config.country })
  return exclusions
}
