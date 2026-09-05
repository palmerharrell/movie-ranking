import { describe, it, expect } from 'vitest'
import { selectGenreSubset, genreSubsetLabel, GENRE_SUBSETS } from './genreSubsets.js'

function movie(overrides) {
  return { id: 'm', genres: [], keywords: [], voteCount: 0, ...overrides }
}

describe('selectGenreSubset', () => {
  it('matches a single-genre subset', () => {
    const movies = [
      movie({ id: 'a', genres: ['Comedy'] }),
      movie({ id: 'b', genres: ['Drama'] }),
    ]
    expect(selectGenreSubset(movies, 'comedy').map((m) => m.id)).toEqual(['a'])
  })

  it('rom-com requires both Romance and Comedy (AND, not OR)', () => {
    const movies = [
      movie({ id: 'romance-only', genres: ['Romance'] }),
      movie({ id: 'comedy-only', genres: ['Comedy'] }),
      movie({ id: 'both', genres: ['Romance', 'Comedy'] }),
    ]
    expect(selectGenreSubset(movies, 'rom-com').map((m) => m.id)).toEqual(['both'])
  })

  it('musicals matches the musical keyword', () => {
    const movies = [
      movie({ id: 'has-keyword', keywords: ['musical'] }),
      movie({ id: 'no-keyword', keywords: [] }),
    ]
    expect(selectGenreSubset(movies, 'musicals').map((m) => m.id)).toEqual(['has-keyword'])
  })

  it('musicals includes the hardcoded Coco/Sister Act exceptions even without the keyword', () => {
    const movies = [
      movie({ id: 'coco', tmdbId: 354912, keywords: [] }),
      movie({ id: 'sister-act', tmdbId: 2005, keywords: [] }),
      movie({ id: 'unrelated', tmdbId: 999, keywords: [] }),
    ]
    expect(selectGenreSubset(movies, 'musicals').map((m) => m.id)).toEqual(['coco', 'sister-act'])
  })

  it('matches by originalLanguage for language subsets', () => {
    const movies = [
      movie({ id: 'fr', originalLanguage: 'fr' }),
      movie({ id: 'en', originalLanguage: 'en' }),
    ]
    expect(selectGenreSubset(movies, 'french').map((m) => m.id)).toEqual(['fr'])
  })

  it('caps to the shared top-N-by-voteCount, sorted descending', () => {
    const movies = [
      movie({ id: 'low', genres: ['Horror'], voteCount: 1 }),
      movie({ id: 'high', genres: ['Horror'], voteCount: 100 }),
    ]
    expect(selectGenreSubset(movies, 'horror').map((m) => m.id)).toEqual(['high', 'low'])
  })

  it('returns the input unchanged for an unknown subset id', () => {
    const movies = [movie({ id: 'a' })]
    expect(selectGenreSubset(movies, 'not-a-real-subset')).toBe(movies)
  })
})

describe('genreSubsetLabel', () => {
  it('returns the configured label for a known id', () => {
    expect(genreSubsetLabel('sci-fi')).toBe('Sci-Fi')
  })

  it('falls back to the id itself for an unknown subset', () => {
    expect(genreSubsetLabel('not-a-real-subset')).toBe('not-a-real-subset')
  })
})

describe('GENRE_SUBSETS', () => {
  it('has a unique id per entry', () => {
    const ids = GENRE_SUBSETS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
