function pairKey(typeA, typeB) {
  return [typeA, typeB].sort().join('|')
}

const FORBIDDEN_PAIRS = new Set(['decade|year'])

export function isForbiddenPair(typeA, typeB) {
  return FORBIDDEN_PAIRS.has(pairKey(typeA, typeB))
}

// "1990s" -> "90s" for display.
export function shortDecade(decade) {
  return decade.replace(/^\d{2}(\d{2}s)$/, '$1')
}

// Most genres read naturally as uncountable/singular ("90s Horror", "90s
// Drama") rather than pluralized. These are the exceptions that do pluralize
// ("90s Comedies", "90s Thrillers").
const PLURALIZE_GENRES = new Set(['Comedy', 'Thriller', 'Mystery', 'Western', 'Documentary'])

function pluralizeGenre(genre) {
  if (!PLURALIZE_GENRES.has(genre)) return genre
  if (genre.endsWith('y')) return `${genre.slice(0, -1)}ies`
  return `${genre}s`
}

const PAIR_LABELS = {
  'decade|genre': ({ decade, genre }) => `${shortDecade(decade)} ${pluralizeGenre(genre)}`,
  'genre|year': ({ genre, year }) => `${year} ${genre} Movies`,
  'director|genre': ({ director, genre }) => `${director} ${pluralizeGenre(genre)}`,
  'cast|genre': ({ cast, genre }) => `${pluralizeGenre(genre)} starring ${cast}`,
  'decade|director': ({ decade, director }) => `${shortDecade(decade)} ${director} Movies`,
  'cast|decade': ({ cast, decade }) => `${shortDecade(decade)} Movies starring ${cast}`,
  'director|year': ({ director, year }) => `${year} ${director} Movies`,
  'cast|year': ({ cast, year }) => `${year} Movies starring ${cast}`,
  'cast|director': ({ cast, director }) => `${director} Movies starring ${cast}`,
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
