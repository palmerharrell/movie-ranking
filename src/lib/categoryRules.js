function pairKey(typeA, typeB) {
  return [typeA, typeB].sort().join('|')
}

const FORBIDDEN_PAIRS = new Set(['decade|year'])

// Collection and keyword are narrow/idiosyncratic enough that they only ever
// appear as a standalone category — collections rarely have 5+ entries to
// begin with, and keyword labels ("Based on a True Story") don't compose
// grammatically with another attribute's modifier the way decade/genre/
// director/studio/language do.
const SINGLE_ONLY_TYPES = new Set(['collection', 'keyword'])

export function isForbiddenPair(typeA, typeB) {
  if (SINGLE_ONLY_TYPES.has(typeA) || SINGLE_ONLY_TYPES.has(typeB)) return true
  return FORBIDDEN_PAIRS.has(pairKey(typeA, typeB))
}

// "1990s" -> "90s" for display.
export function shortDecade(decade) {
  return decade.replace(/^\d{2}(\d{2}s)$/, '$1')
}

// "Knives Out Collection" -> "Knives Out" for display. TMDb collection names
// aren't all suffixed with "Collection" — some real examples in the pool use
// "Series" or "Trilogy" instead, or misspell it as "Colletion" — so strip any
// of those trailing generic words rather than just the exact "Collection".
export function stripCollectionSuffix(name) {
  return name.replace(/ (Collection|Colletion|Series|Trilogy)$/, '')
}

// TMDb uses a few non-standard codes for original_language that aren't real
// ISO 639-1 codes Intl.DisplayNames can resolve — e.g. "cn" for Cantonese
// (vs. the standard "zh" for Chinese), which otherwise renders as the raw
// code ("Cn Movies").
const LANGUAGE_NAME_OVERRIDES = {
  cn: 'Cantonese',
}

// ISO 639-1 code -> English display name ("fr" -> "French"), via the
// built-in Intl API so no hand-maintained language-name map is needed.
export function languageName(code) {
  if (LANGUAGE_NAME_OVERRIDES[code]) return LANGUAGE_NAME_OVERRIDES[code]
  return new Intl.DisplayNames(['en'], { type: 'language' }).of(code)
}

// Most genres read naturally as uncountable/singular ("90s Horror", "90s
// Drama") rather than pluralized. These are the exceptions that do pluralize
// ("90s Comedies", "90s Thrillers") — for these, the plural noun already
// implies "Movies" and gets no further suffix.
const PLURALIZE_GENRES = new Set(['Comedy', 'Thriller', 'Mystery', 'Western', 'Documentary'])

// Genres whose display form isn't just the raw TMDb name + " Movies".
const GENRE_LABEL_OVERRIDES = {
  Animation: 'Animated Movies',
}

function pluralizeGenre(genre) {
  if (genre.endsWith('y')) return `${genre.slice(0, -1)}ies`
  return `${genre}s`
}

// Full noun phrase for a genre, for use standalone or composed with another
// attribute's modifier ("90s " + genreLabel("Crime") -> "90s Crime Movies").
export function genreLabel(genre) {
  if (GENRE_LABEL_OVERRIDES[genre]) return GENRE_LABEL_OVERRIDES[genre]
  if (PLURALIZE_GENRES.has(genre)) return pluralizeGenre(genre)
  return `${genre} Movies`
}

const PAIR_LABELS = {
  'decade|genre': ({ decade, genre }) => `${shortDecade(decade)} ${genreLabel(genre)}`,
  'genre|year': ({ genre, year }) => `${year} ${genreLabel(genre)}`,
  'director|genre': ({ director, genre }) => `${director} ${genreLabel(genre)}`,
  'cast|genre': ({ cast, genre }) => `${genreLabel(genre)} starring ${cast}`,
  'decade|director': ({ decade, director }) => `${shortDecade(decade)} ${director} Movies`,
  'cast|decade': ({ cast, decade }) => `${shortDecade(decade)} Movies starring ${cast}`,
  'director|year': ({ director, year }) => `${year} ${director} Movies`,
  'cast|year': ({ cast, year }) => `${year} Movies starring ${cast}`,
  'cast|director': ({ cast, director }) => `${director} Movies starring ${cast}`,
  'cast|studio': ({ cast, studio }) => `${studio} Movies starring ${cast}`,
  'decade|studio': ({ decade, studio }) => `${shortDecade(decade)} ${studio} Movies`,
  'director|studio': ({ director, studio }) => `${studio} ${director} Movies`,
  'genre|studio': ({ genre, studio }) => `${studio} ${genreLabel(genre)}`,
  'studio|year': ({ studio, year }) => `${year} ${studio} Movies`,
  'cast|language': ({ cast, language }) => `${languageName(language)} Movies starring ${cast}`,
  'decade|language': ({ decade, language }) => `${shortDecade(decade)} ${languageName(language)} Movies`,
  'director|language': ({ director, language }) => `${languageName(language)} ${director} Movies`,
  'genre|language': ({ genre, language }) => `${languageName(language)} ${genreLabel(genre)}`,
  'language|year': ({ language, year }) => `${year} ${languageName(language)} Movies`,
  'language|studio': ({ language, studio }) => `${languageName(language)} ${studio} Movies`,
}

export function pairLabel(picks) {
  const key = pairKey(picks[0].type, picks[1].type)
  const values = {
    [picks[0].type]: picks[0].value,
    [picks[1].type]: picks[1].value,
  }
  const format = PAIR_LABELS[key]
  if (!format) return `${picks[0].value} + ${picks[1].value} Movies`
  return format(values)
}
