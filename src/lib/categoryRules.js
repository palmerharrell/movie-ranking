function pairKey(typeA, typeB) {
  return [typeA, typeB].sort().join('|')
}

const FORBIDDEN_PAIRS = new Set(['decade|year'])

export function isForbiddenPair(typeA, typeB) {
  return FORBIDDEN_PAIRS.has(pairKey(typeA, typeB))
}

const PAIR_LABELS = {
  'decade|genre': ({ decade, genre }) => `${decade} ${genre} Movies`,
  'genre|year': ({ genre, year }) => `${year} ${genre} Movies`,
  'director|genre': ({ director, genre }) => `${director} ${genre} Movies`,
  'cast|genre': ({ cast, genre }) => `${genre} Movies starring ${cast}`,
  'decade|director': ({ decade, director }) => `${decade} Movies Directed by ${director}`,
  'cast|decade': ({ cast, decade }) => `${decade} Movies starring ${cast}`,
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
  return PAIR_LABELS[key](values)
}
