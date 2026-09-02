import { describe, it, expect } from 'vitest'
import {
  isForbiddenPair,
  shortDecade,
  stripCollectionSuffix,
  languageName,
  pairLabel,
} from './categoryRules.js'

describe('isForbiddenPair', () => {
  it('forbids decade paired with year, in either order', () => {
    expect(isForbiddenPair('decade', 'year')).toBe(true)
    expect(isForbiddenPair('year', 'decade')).toBe(true)
  })

  it('allows other pairs', () => {
    expect(isForbiddenPair('genre', 'year')).toBe(false)
    expect(isForbiddenPair('director', 'genre')).toBe(false)
  })

  it('forbids collection paired with any other type, including itself and keyword', () => {
    const others = ['director', 'genre', 'decade', 'year', 'cast', 'studio', 'language', 'keyword']
    for (const type of others) {
      expect(isForbiddenPair('collection', type)).toBe(true)
      expect(isForbiddenPair(type, 'collection')).toBe(true)
    }
  })

  it('forbids keyword paired with any other type, including itself and collection', () => {
    const others = ['director', 'genre', 'decade', 'year', 'cast', 'studio', 'language', 'collection']
    for (const type of others) {
      expect(isForbiddenPair('keyword', type)).toBe(true)
      expect(isForbiddenPair(type, 'keyword')).toBe(true)
    }
  })

  it('allows studio and language paired with every non-single-only type', () => {
    const others = ['director', 'genre', 'decade', 'year', 'cast']
    for (const type of others) {
      expect(isForbiddenPair('studio', type)).toBe(false)
      expect(isForbiddenPair('language', type)).toBe(false)
    }
    expect(isForbiddenPair('studio', 'language')).toBe(false)
  })
})

describe('shortDecade', () => {
  it('shortens a 4-digit decade to 2 digits', () => {
    expect(shortDecade('1990s')).toBe('90s')
    expect(shortDecade('2000s')).toBe('00s')
  })

  it('leaves an already-short decade unchanged', () => {
    expect(shortDecade('90s')).toBe('90s')
  })
})

describe('pairLabel genre labeling', () => {
  // Genres in PLURALIZE_GENRES pluralize (the plural noun already implies
  // "Movies"); Animation gets its own "Animated Movies" phrasing; every
  // other genre appends " Movies" to the raw name (issue #87).
  const pluralizes = ['Comedy', 'Thriller', 'Mystery', 'Western', 'Documentary']
  const appendsMovies = [
    'Horror',
    'Action',
    'Crime',
    'War',
    'Family',
    'Music',
    'History',
    'Science Fiction',
    'Fantasy',
    'Drama',
    'Romance',
    'Adventure',
  ]

  it.each(pluralizes)('pluralizes %s in decade+genre labels', (genre) => {
    const label = pairLabel([
      { type: 'decade', value: '1990s' },
      { type: 'genre', value: genre },
    ])
    expect(label).not.toMatch(new RegExp(`\\b${genre}\\b`))
    expect(label).toMatch(/^90s /)
  })

  it.each(appendsMovies)('appends "Movies" to %s in decade+genre labels', (genre) => {
    const label = pairLabel([
      { type: 'decade', value: '1990s' },
      { type: 'genre', value: genre },
    ])
    expect(label).toBe(`90s ${genre} Movies`)
  })

  it('uses "Animated Movies" for Animation in decade+genre labels', () => {
    const label = pairLabel([
      { type: 'decade', value: '1990s' },
      { type: 'genre', value: 'Animation' },
    ])
    expect(label).toBe('90s Animated Movies')
  })

  it('pluralizes Comedy to Comedies in director+genre labels', () => {
    const label = pairLabel([
      { type: 'director', value: 'Wes Anderson' },
      { type: 'genre', value: 'Comedy' },
    ])
    expect(label).toBe('Wes Anderson Comedies')
  })

  it('appends "Movies" to Horror in cast+genre labels', () => {
    const label = pairLabel([
      { type: 'cast', value: 'Bruce Willis' },
      { type: 'genre', value: 'Horror' },
    ])
    expect(label).toBe('Horror Movies starring Bruce Willis')
  })
})

describe('pairLabel decade shortening', () => {
  it('shortens decade in decade+director labels', () => {
    const label = pairLabel([
      { type: 'decade', value: '1990s' },
      { type: 'director', value: 'Steven Spielberg' },
    ])
    expect(label).toBe('90s Steven Spielberg Movies')
  })

  it('shortens decade in cast+decade labels', () => {
    const label = pairLabel([
      { type: 'cast', value: 'Steve Buscemi' },
      { type: 'decade', value: '1990s' },
    ])
    expect(label).toBe('90s Movies starring Steve Buscemi')
  })
})

describe('stripCollectionSuffix', () => {
  it('strips a trailing " Collection"', () => {
    expect(stripCollectionSuffix('Knives Out Collection')).toBe('Knives Out')
  })

  it('leaves a name with no "Collection" suffix unchanged', () => {
    expect(stripCollectionSuffix('The Matrix')).toBe('The Matrix')
  })

  it('strips a trailing " Series" or " Trilogy"', () => {
    expect(stripCollectionSuffix('The Space Odyssey Series')).toBe('The Space Odyssey')
    expect(stripCollectionSuffix("John Singleton's Hood Trilogy")).toBe("John Singleton's Hood")
  })

  it('strips a misspelled trailing " Colletion" (real TMDb data)', () => {
    expect(stripCollectionSuffix('Days of Thunder Colletion')).toBe('Days of Thunder')
  })
})

describe('languageName', () => {
  it('resolves ISO 639-1 codes to English display names', () => {
    expect(languageName('fr')).toBe('French')
    expect(languageName('ja')).toBe('Japanese')
    expect(languageName('ko')).toBe('Korean')
  })

  it('overrides "cn", a non-ISO code TMDb uses for Cantonese', () => {
    expect(languageName('cn')).toBe('Cantonese')
  })
})

describe('pairLabel studio pairs', () => {
  it('formats cast+studio', () => {
    const label = pairLabel([
      { type: 'cast', value: 'Bill Murray' },
      { type: 'studio', value: 'A24' },
    ])
    expect(label).toBe('A24 Movies starring Bill Murray')
  })

  it('formats decade+studio', () => {
    const label = pairLabel([
      { type: 'decade', value: '1990s' },
      { type: 'studio', value: 'Miramax' },
    ])
    expect(label).toBe('90s Miramax Movies')
  })

  it('formats director+studio', () => {
    const label = pairLabel([
      { type: 'director', value: 'Wes Anderson' },
      { type: 'studio', value: 'A24' },
    ])
    expect(label).toBe('A24 Wes Anderson Movies')
  })

  it('formats genre+studio', () => {
    const label = pairLabel([
      { type: 'genre', value: 'Comedy' },
      { type: 'studio', value: 'A24' },
    ])
    expect(label).toBe('A24 Comedies')
  })

  it('formats studio+year', () => {
    const label = pairLabel([
      { type: 'studio', value: 'Pixar' },
      { type: 'year', value: 1999 },
    ])
    expect(label).toBe('1999 Pixar Movies')
  })
})

describe('pairLabel language pairs', () => {
  it('formats cast+language', () => {
    const label = pairLabel([
      { type: 'cast', value: 'Song Kang-ho' },
      { type: 'language', value: 'ko' },
    ])
    expect(label).toBe('Korean Movies starring Song Kang-ho')
  })

  it('formats decade+language', () => {
    const label = pairLabel([
      { type: 'decade', value: '1990s' },
      { type: 'language', value: 'fr' },
    ])
    expect(label).toBe('90s French Movies')
  })

  it('formats director+language', () => {
    const label = pairLabel([
      { type: 'director', value: 'Hayao Miyazaki' },
      { type: 'language', value: 'ja' },
    ])
    expect(label).toBe('Japanese Hayao Miyazaki Movies')
  })

  it('formats genre+language', () => {
    const label = pairLabel([
      { type: 'genre', value: 'Thriller' },
      { type: 'language', value: 'ko' },
    ])
    expect(label).toBe('Korean Thrillers')
  })

  it('formats language+year', () => {
    const label = pairLabel([
      { type: 'language', value: 'fr' },
      { type: 'year', value: 1959 },
    ])
    expect(label).toBe('1959 French Movies')
  })

  it('formats language+studio', () => {
    const label = pairLabel([
      { type: 'language', value: 'fr' },
      { type: 'studio', value: 'Neon' },
    ])
    expect(label).toBe('French Neon Movies')
  })
})
