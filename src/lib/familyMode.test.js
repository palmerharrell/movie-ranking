import { describe, it, expect } from 'vitest'
import { isFamilyGenre, selectFamilySubset, familySubsetExclusions } from './familyMode.js'

describe('isFamilyGenre', () => {
  it('accepts a movie tagged with the Family genre', () => {
    expect(isFamilyGenre({ genres: ['Comedy', 'Family'] })).toBe(true)
  })

  it('rejects a movie without the Family genre', () => {
    expect(isFamilyGenre({ genres: ['Drama'] })).toBe(false)
    expect(isFamilyGenre({})).toBe(false)
  })

  it('has no MPAA safety floor — an R-rated Family-genre movie still qualifies (#152)', () => {
    expect(isFamilyGenre({ genres: ['Family'], mpaaRating: 'R' })).toBe(true)
  })

  it('excludes a family-safe-rated movie that lacks the Family genre (#152)', () => {
    expect(isFamilyGenre({ genres: ['Drama'], mpaaRating: 'G' })).toBe(false)
  })
})

describe('selectFamilySubset', () => {
  it('filters to Family-genre movies and caps to the top-N by voteCount', () => {
    const movies = [
      { id: '1', genres: ['Family'], voteCount: 10 },
      { id: '2', genres: ['Family'], voteCount: 50 },
      { id: '3', genres: ['Drama'], voteCount: 1000 },
    ]
    expect(selectFamilySubset(movies).map((m) => m.id)).toEqual(['2', '1'])
  })
})

describe('familySubsetExclusions', () => {
  it('excludes the Family genre, mirroring genreSubsetExclusions (#160)', () => {
    expect(familySubsetExclusions()).toEqual([{ type: 'genre', value: 'Family' }])
  })
})
