import { describe, it, expect } from 'vitest'
import { applyPairwiseResult, rankFivePack } from './elo.js'

describe('applyPairwiseResult', () => {
  it('raises the winner and lowers the loser when ratings are equal', () => {
    const winner = { id: 'a', eloRating: 1000 }
    const loser = { id: 'b', eloRating: 1000 }
    const result = applyPairwiseResult(winner, loser)
    expect(result.a).toBeGreaterThan(1000)
    expect(result.b).toBeLessThan(1000)
    expect(result.a - 1000).toBeCloseTo(1000 - result.b, 5)
  })

  it('gives a small bump when a favorite beats an underdog', () => {
    const winner = { id: 'a', eloRating: 1400 }
    const loser = { id: 'b', eloRating: 1000 }
    const result = applyPairwiseResult(winner, loser)
    const gain = result.a - 1400
    expect(gain).toBeGreaterThan(0)
    expect(gain).toBeLessThan(5)
  })

  it('gives a big bump when an underdog beats a favorite', () => {
    const winner = { id: 'b', eloRating: 1000 }
    const loser = { id: 'a', eloRating: 1400 }
    const result = applyPairwiseResult(winner, loser)
    const gain = result.b - 1000
    expect(gain).toBeGreaterThan(25)
  })
})

describe('rankFivePack', () => {
  const movies = [
    { id: '1', eloRating: 1000 },
    { id: '2', eloRating: 1000 },
    { id: '3', eloRating: 1000 },
    { id: '4', eloRating: 1000 },
    { id: '5', eloRating: 1000 },
  ]

  it('throws if not given exactly 5 movies', () => {
    expect(() => rankFivePack(movies.slice(0, 4))).toThrow()
  })

  it('produces a strictly descending rating order matching the input order', () => {
    const result = rankFivePack(movies)
    const ratings = movies.map((m) => result[m.id])
    for (let i = 0; i < ratings.length - 1; i++) {
      expect(ratings[i]).toBeGreaterThan(ratings[i + 1])
    }
  })

  it('returns an entry for every movie', () => {
    const result = rankFivePack(movies)
    expect(Object.keys(result).sort()).toEqual(['1', '2', '3', '4', '5'])
  })
})
