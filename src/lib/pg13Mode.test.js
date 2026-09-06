import { describe, it, expect } from 'vitest'
import { isPg13OrUnder, selectPg13OrUnder } from './pg13Mode.js'

describe('isPg13OrUnder', () => {
  it('accepts G, PG, and PG-13', () => {
    expect(isPg13OrUnder({ mpaaRating: 'G' })).toBe(true)
    expect(isPg13OrUnder({ mpaaRating: 'PG' })).toBe(true)
    expect(isPg13OrUnder({ mpaaRating: 'PG-13' })).toBe(true)
  })

  it('rejects R and NC-17', () => {
    expect(isPg13OrUnder({ mpaaRating: 'R' })).toBe(false)
    expect(isPg13OrUnder({ mpaaRating: 'NC-17' })).toBe(false)
  })

  it('rejects a post-1968 movie with no US certification (#193)', () => {
    expect(isPg13OrUnder({ mpaaRating: null, year: 1968 })).toBe(false)
    expect(isPg13OrUnder({ mpaaRating: null, year: 2020 })).toBe(false)
    expect(isPg13OrUnder({})).toBe(false)
  })

  it('accepts a pre-1968 movie with no US certification, since the ratings system did not exist yet (#193)', () => {
    expect(isPg13OrUnder({ mpaaRating: null, year: 1967 })).toBe(true)
    expect(isPg13OrUnder({ mpaaRating: null, year: 1953 })).toBe(true)
  })
})

describe('selectPg13OrUnder', () => {
  it('filters to only PG-13-and-under movies', () => {
    const movies = [
      { id: '1', mpaaRating: 'G' },
      { id: '2', mpaaRating: 'R' },
      { id: '3', mpaaRating: 'PG-13' },
      { id: '4', mpaaRating: null },
    ]
    expect(selectPg13OrUnder(movies).map((m) => m.id)).toEqual(['1', '3'])
  })
})
