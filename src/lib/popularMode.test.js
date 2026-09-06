import { describe, it, expect } from 'vitest'
import {
  selectPopular,
  selectTopByVoteCount,
  selectTopByVoteCountWithEraQuota,
  POPULAR_POOL_SIZE,
} from './popularMode.js'

function movie(id, voteCount, year) {
  return { id, voteCount, year }
}

describe('selectTopByVoteCount', () => {
  it('caps to an arbitrary n, reused by genreSubsets.js', () => {
    const movies = [movie('a', 1), movie('b', 5), movie('c', 3)]
    expect(selectTopByVoteCount(movies, 2).map((m) => m.id)).toEqual(['b', 'c'])
  })
})

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

  it('excludes Marvel/DC movies even if they would otherwise rank highly (#180)', () => {
    const movies = [
      { id: 'marvel', voteCount: 999, studio: 'Marvel Studios' },
      { id: 'plain', voteCount: 1 },
    ]
    expect(selectPopular(movies).map((m) => m.id)).toEqual(['plain'])
  })
})

describe('selectTopByVoteCountWithEraQuota', () => {
  it('returns the plain top-N unchanged when the natural ranking already meets the quota (#203)', () => {
    const movies = [
      movie('classic-1', 100, 1950),
      movie('classic-2', 90, 1960),
      movie('modern', 80, 2010),
    ]
    const result = selectTopByVoteCountWithEraQuota(movies, 3, 2, 1980)
    expect(result.map((m) => m.id)).toEqual(['classic-1', 'classic-2', 'modern'])
  })

  it('tops up with the best classics outside the natural top-N when the quota is not met (#203)', () => {
    const movies = [
      movie('modern-1', 100, 2010),
      movie('modern-2', 90, 2015),
      movie('modern-3', 80, 2020),
      movie('best-classic', 10, 1950),
      movie('worse-classic', 5, 1940),
    ]
    // n=3, quota=1: natural top 3 are all modern, so the best classic
    // (voteCount 10) should bump the lowest-voteCount modern entry.
    const result = selectTopByVoteCountWithEraQuota(movies, 3, 1, 1980)
    expect(result.map((m) => m.id)).toEqual(['modern-1', 'modern-2', 'best-classic'])
  })

  it('caps the added classics at however many are actually available', () => {
    const movies = [
      movie('modern-1', 100, 2010),
      movie('modern-2', 90, 2015),
      movie('only-classic', 5, 1950),
    ]
    // Quota of 2 classics requested, but only 1 exists in the whole pool.
    const result = selectTopByVoteCountWithEraQuota(movies, 3, 2, 1980)
    expect(result.map((m) => m.id).sort()).toEqual(['modern-1', 'modern-2', 'only-classic'])
  })

  it('treats a movie with no year as non-classic', () => {
    const movies = [movie('no-year', 100), movie('classic', 1, 1950)]
    const result = selectTopByVoteCountWithEraQuota(movies, 2, 1, 1980)
    expect(result.map((m) => m.id).sort()).toEqual(['classic', 'no-year'])
  })

  it('keeps the result sorted descending by voteCount', () => {
    const movies = [
      movie('modern-1', 100, 2010),
      movie('modern-2', 90, 2015),
      movie('modern-3', 80, 2020),
      movie('best-classic', 10, 1950),
    ]
    const result = selectTopByVoteCountWithEraQuota(movies, 3, 1, 1980)
    expect(result.map((m) => m.voteCount)).toEqual([100, 90, 10])
  })
})
