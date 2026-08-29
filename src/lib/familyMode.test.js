import { describe, it, expect } from 'vitest'
import { isFamilySafe } from './familyMode.js'

describe('isFamilySafe', () => {
  it.each(['G', 'PG', 'PG-13'])('accepts %s', (mpaaRating) => {
    expect(isFamilySafe({ mpaaRating })).toBe(true)
  })

  it.each(['R', 'NC-17', 'Unrated'])('rejects %s', (mpaaRating) => {
    expect(isFamilySafe({ mpaaRating })).toBe(false)
  })

  it('rejects a movie with no confirmed rating', () => {
    expect(isFamilySafe({ mpaaRating: null })).toBe(false)
    expect(isFamilySafe({})).toBe(false)
  })
})
