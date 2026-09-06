import { describe, it, expect } from 'vitest'
import {
  selectGenreSubset,
  genreSubsetLabel,
  genreSubsetExclusions,
  GENRE_SUBSETS,
  GENRE_SUBSET_POOL_SIZE,
} from './genreSubsets.js'
import { POPULAR_POOL_SIZE } from './popularMode.js'

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

  it('matches by productionCountries including GB for the british subset', () => {
    const movies = [
      movie({ id: 'gb', productionCountries: ['GB'] }),
      movie({ id: 'gb-and-us', productionCountries: ['US', 'GB'] }),
      movie({ id: 'us-only', productionCountries: ['US'] }),
      movie({ id: 'no-countries' }),
    ]
    expect(selectGenreSubset(movies, 'british').map((m) => m.id)).toEqual(['gb', 'gb-and-us'])
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

  it('excludes Marvel/DC movies from a non-comicbook subset even if they match its attribute (#180)', () => {
    const movies = [
      movie({ id: 'dc-action', genres: ['Action'], studio: 'Warner Bros. Pictures', collection: 'Batman Collection' }),
      movie({ id: 'plain-action', genres: ['Action'] }),
    ]
    expect(selectGenreSubset(movies, 'action').map((m) => m.id)).toEqual(['plain-action'])
  })

  it('comicbook matches Marvel/DC movies and other superhero-keyword movies, but not plain genre matches (#181)', () => {
    const movies = [
      movie({ id: 'marvel', studio: 'Marvel Studios' }),
      movie({ id: 'other-superhero', keywords: ['superhero'] }),
      movie({ id: 'plain-action', genres: ['Action'] }),
    ]
    expect(selectGenreSubset(movies, 'comicbook').map((m) => m.id).sort()).toEqual([
      'marvel',
      'other-superhero',
    ])
  })

  it('caps to GENRE_SUBSET_POOL_SIZE, which is smaller than Popular\'s POPULAR_POOL_SIZE (#165)', () => {
    expect(GENRE_SUBSET_POOL_SIZE).toBeLessThan(POPULAR_POOL_SIZE)
    const movies = Array.from({ length: GENRE_SUBSET_POOL_SIZE + 50 }, (_, i) =>
      movie({ id: `m${i}`, genres: ['Horror'], voteCount: i }),
    )
    expect(selectGenreSubset(movies, 'horror')).toHaveLength(GENRE_SUBSET_POOL_SIZE)
  })

  it('reserves room for classic-era movies even when modern entries would otherwise fill the whole cap (#203)', () => {
    const modern = Array.from({ length: GENRE_SUBSET_POOL_SIZE }, (_, i) =>
      movie({ id: `modern${i}`, genres: ['Horror'], voteCount: 1000 + i, year: 2010 }),
    )
    const classic = movie({ id: 'best-classic', genres: ['Horror'], voteCount: 5, year: 1950 })
    const result = selectGenreSubset([...modern, classic], 'horror')
    expect(result).toHaveLength(GENRE_SUBSET_POOL_SIZE)
    expect(result.map((m) => m.id)).toContain('best-classic')
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

describe('genreSubsetExclusions', () => {
  it('returns the genre attribute for a single-genre subset', () => {
    expect(genreSubsetExclusions('sci-fi')).toEqual([{ type: 'genre', value: 'Science Fiction' }])
  })

  it('returns both genre attributes for a two-genre subset (rom-com)', () => {
    expect(genreSubsetExclusions('rom-com')).toEqual([
      { type: 'genre', value: 'Romance' },
      { type: 'genre', value: 'Comedy' },
    ])
  })

  it('returns the language attribute for a language subset', () => {
    expect(genreSubsetExclusions('french')).toEqual([{ type: 'language', value: 'fr' }])
  })

  it('returns the keyword attribute for musicals', () => {
    expect(genreSubsetExclusions('musicals')).toEqual([{ type: 'keyword', value: 'musical' }])
  })

  it('returns an empty array for an unknown subset id', () => {
    expect(genreSubsetExclusions('not-a-real-subset')).toEqual([])
  })

  it('returns the country attribute for british', () => {
    expect(genreSubsetExclusions('british')).toEqual([{ type: 'country', value: 'GB' }])
  })
})
