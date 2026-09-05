import { describe, it, expect } from 'vitest'
import { selectPopular, POPULAR_POOL_SIZE } from './popularMode.js'

function movie(id, voteCount) {
  return { id, voteCount }
}

describe('selectPopular', () => {
  it('keeps only the top POPULAR_POOL_SIZE by voteCount', () => {
    const movies = Array.from({ length: POPULAR_POOL_SIZE + 10 }, (_, i) => movie(i, i))
    const result = selectPopular(movies)
    expect(result).toHaveLength(POPULAR_POOL_SIZE)
    expect(result.map((m) => m.id)).toEqual(
      Array.from({ length: POPULAR_POOL_SIZE }, (_, i) => movies.length - 1 - i),
    )
  })

  it('sorts descending by voteCount', () => {
    const movies = [movie('a', 5), movie('b', 50), movie('c', 20)]
    expect(selectPopular(movies).map((m) => m.id)).toEqual(['b', 'c', 'a'])
  })

  it('treats missing/null voteCount as 0, sorting it last', () => {
    const movies = [movie('a', 10), movie('b', null), movie('c', undefined)]
    expect(selectPopular(movies).map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('returns everything unchanged in order when under the cap', () => {
    const movies = [movie('a', 1), movie('b', 2)]
    expect(selectPopular(movies).map((m) => m.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const movies = [movie('a', 1), movie('b', 2)]
    selectPopular(movies)
    expect(movies.map((m) => m.id)).toEqual(['a', 'b'])
  })
})
