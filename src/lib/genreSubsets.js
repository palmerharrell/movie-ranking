import {
  selectTopByVoteCountWithQuotas,
  CLASSIC_ERA_CUTOFF_YEAR,
  CLASSIC_ERA_QUOTA,
  CANONICAL_QUOTA,
  isCanonicalSourced,
} from './popularMode.js'
import { isComicBook, isMarvelOrDc } from './comicBookMovies.js'

// Tune later — not a hard requirement from #165, just a starting cutoff.
// Smaller than POPULAR_POOL_SIZE: niche genre/language/country subsets don't
// have as much depth of genuinely popular titles as Popular/Family/All
// Movies do, so sharing the same 300-movie cap left a long tail of obscure
// matches users ended up skipping en masse (#165, e.g. nearly a third of the
// Sci-Fi subset). Raised from 100 to 150 (#330) — 100 gave a full subset run
// too few packs for Head to Head to show up more than once or twice (see
// HEAD_TO_HEAD_CHANCE below), on top of just being more depth generally.
export const GENRE_SUBSET_POOL_SIZE = 150

// Coco, Sister Act, Flower Drum Song (1961), and Thoroughly Modern Millie
// (1967) are real musicals TMDb doesn't tag with the `musical` keyword
// (confirmed live against TMDb's API during planning, #150/#205) — a small
// curated exception, same spirit as NOTABLE_STUDIOS/KEYWORD_LABELS in
// curatedAttributes.js.
const MUSICAL_TMDB_ID_EXCEPTIONS = [354912, 2005, 25105, 32489]

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

// Directors, unlike every entry in GENRE_SUBSETS, aren't a fixed curated
// list — which directors qualify depends on who's actually prolific in the
// current pool, so there's no static array to add them to. Instead a
// director subset's id embeds the director's own name verbatim
// (`director-Christopher Nolan`) so it's self-describing: label lookup and
// matching both just need the id, not a re-query of "who is director #4."
// A raw name (rather than a slug) avoids collisions between two directors
// whose slugs would otherwise coincide.
const DIRECTOR_ID_PREFIX = 'director-'

export function directorSubsetId(name) {
  return `${DIRECTOR_ID_PREFIX}${name}`
}

export function isDirectorSubsetId(subsetId) {
  return typeof subsetId === 'string' && subsetId.startsWith(DIRECTOR_ID_PREFIX)
}

export function directorNameFromId(subsetId) {
  return subsetId.slice(DIRECTOR_ID_PREFIX.length)
}

// At least this many pool movies before a director gets their own subset
// entry — otherwise the Directors group would be cluttered with people who
// have only directed 2-3 movies in the pool, no more a meaningful "top
// director" than anyone else.
export const DIRECTOR_MIN_MOVIE_COUNT = 10

// How many directors get their own subset entry, mirroring GENRE_SUBSETS'
// own rough count (15 genre entries).
export const DIRECTOR_SUBSET_LIMIT = 15

// The top directors by movie count in the given (unfiltered) pool, as
// `{ id, label, count }` for the picker's Directors group — computed at
// runtime from each movie's own `director` field rather than a precomputed
// list, since counting a few hundred movies is cheap and this stays correct
// automatically as the pool grows.
export function getTopDirectors(movies) {
  const counts = new Map()
  for (const movie of movies) {
    if (!movie.director) continue
    counts.set(movie.director, (counts.get(movie.director) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= DIRECTOR_MIN_MOVIE_COUNT)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, DIRECTOR_SUBSET_LIMIT)
    .map(([name, count]) => ({ id: directorSubsetId(name), label: name, count }))
}

// Filters to movies matching the subset's own attributes (genre/keyword/
// language) — not by which sources[] tag got a movie into the pool, so a
// Comedy added via personal import still surfaces here if popular enough,
// not only ones fetched via the top-comedy discover source (#150). Then
// caps to GENRE_SUBSET_POOL_SIZE — smaller than Popular's cap since these
// niche subsets run shallower on genuinely popular titles (#165) — with a
// reserved floor for classic-era movies (#203) and one for movies from a
// canonical critical/preservation source (#207), so a flood of modern or
// merely-mainstream matches can't crowd either out; see
// selectTopByVoteCountWithQuotas in popularMode.js. Every subset except
// Comic Book itself also excludes Marvel/DC movies (#180) — Comic Book is
// the one place they're still rankable (#181).
export function selectGenreSubset(movies, subsetId) {
  if (isDirectorSubsetId(subsetId)) {
    const name = directorNameFromId(subsetId)
    // A director subset is specifically about that person's own body of
    // work, so — same reasoning as Comic Book being the one subset that
    // doesn't exclude Marvel/DC (#181) — it isn't filtered through
    // isMarvelOrDc either; a director's MCU/DCEU credit is still their
    // movie.
    const matched = movies.filter((m) => m.director === name)
    return selectTopByVoteCountWithQuotas(matched, GENRE_SUBSET_POOL_SIZE, [
      { matches: (m) => m.year != null && m.year < CLASSIC_ERA_CUTOFF_YEAR, quota: CLASSIC_ERA_QUOTA },
      { matches: isCanonicalSourced, quota: CANONICAL_QUOTA },
    ])
  }
  const config = GENRE_SUBSETS.find((s) => s.id === subsetId)
  if (!config) return movies
  const matched = movies.filter(config.matches)
  const scoped = subsetId === 'comicbook' ? matched : matched.filter((m) => !isMarvelOrDc(m))
  return selectTopByVoteCountWithQuotas(scoped, GENRE_SUBSET_POOL_SIZE, [
    { matches: (m) => m.year != null && m.year < CLASSIC_ERA_CUTOFF_YEAR, quota: CLASSIC_ERA_QUOTA },
    { matches: isCanonicalSourced, quota: CANONICAL_QUOTA },
  ])
}

// Display label for any genre/language subset id — used by SaveRankingModal/
// ResetRankingModal to build generic copy without a bespoke entry per id.
export function genreSubsetLabel(subsetId) {
  if (isDirectorSubsetId(subsetId)) return directorNameFromId(subsetId)
  return GENRE_SUBSETS.find((s) => s.id === subsetId)?.label ?? subsetId
}

const GENERAL_SUBSET_LABELS = { popular: 'Popular', family: 'Family', all: 'All' }

// Display label for any subset id — general (Popular/Family/All) or
// genre/language/country — used by SaveRankingModal/ResetRankingModal/
// LoadRankingView so none of them need their own popular/family special
// case layered on top of genreSubsetLabel's per-genre fallback.
export function subsetLabel(subsetId) {
  return GENERAL_SUBSET_LABELS[subsetId] ?? genreSubsetLabel(subsetId)
}

// The category-generator attribute type/value pair(s) that would be
// tautological to build a category on while this subset is active (#160) —
// every movie in the subset's pool already matches it by construction, so
// e.g. a "Science Fiction Movies" category (or "80s Sci-Fi Movies" pairing)
// conveys no information while the Sci-Fi subset is selected. Returns []
// for unknown/non-genre subset ids (Popular/Family/All Movies have no
// defining attribute to exclude).
export function genreSubsetExclusions(subsetId) {
  if (isDirectorSubsetId(subsetId)) {
    return [{ type: 'director', value: directorNameFromId(subsetId) }]
  }
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
