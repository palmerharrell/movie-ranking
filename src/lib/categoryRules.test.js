import { describe, it, expect } from 'vitest'
import { isForbiddenPair, shortDecade, pairLabel } from './categoryRules.js'

describe('isForbiddenPair', () => {
  it('forbids decade paired with year, in either order', () => {
    expect(isForbiddenPair('decade', 'year')).toBe(true)
    expect(isForbiddenPair('year', 'decade')).toBe(true)
  })

  it('allows other pairs', () => {
    expect(isForbiddenPair('genre', 'year')).toBe(false)
    expect(isForbiddenPair('director', 'genre')).toBe(false)
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

describe('pairLabel genre pluralization', () => {
  // Genres in PLURALIZE_GENRES pluralize; everything else (the majority)
  // stays singular, per issue #66.
  const pluralizes = ['Comedy', 'Thriller', 'Mystery', 'Western', 'Documentary']
  const staysSingular = [
    'Horror',
    'Action',
    'Crime',
    'War',
    'Family',
    'Music',
    'History',
    'Animation',
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

  it.each(staysSingular)('keeps %s singular in decade+genre labels', (genre) => {
    const label = pairLabel([
      { type: 'decade', value: '1990s' },
      { type: 'genre', value: genre },
    ])
    expect(label).toBe(`90s ${genre}`)
  })

  it('pluralizes Comedy to Comedies in director+genre labels', () => {
    const label = pairLabel([
      { type: 'director', value: 'Wes Anderson' },
      { type: 'genre', value: 'Comedy' },
    ])
    expect(label).toBe('Wes Anderson Comedies')
  })

  it('keeps Horror singular in cast+genre labels', () => {
    const label = pairLabel([
      { type: 'cast', value: 'Bruce Willis' },
      { type: 'genre', value: 'Horror' },
    ])
    expect(label).toBe('Horror starring Bruce Willis')
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
