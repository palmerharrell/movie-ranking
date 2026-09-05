import { beforeEach, describe, it, expect } from 'vitest'
import {
  mergeWithLocalState,
  applyRankToLocalState,
  resetLocalState,
  markSkipped,
  unmarkSkipped,
} from './localRankingStore.js'

function createMemoryStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  }
}

beforeEach(() => {
  globalThis.localStorage = createMemoryStorage()
})

const STATIC_MOVIES = [
  { id: '1', title: 'A' },
  { id: '2', title: 'B' },
  { id: '3', title: 'C' },
]

describe('mergeWithLocalState', () => {
  it('defaults unranked movies to 1000/0', () => {
    const merged = mergeWithLocalState(STATIC_MOVIES)
    for (const m of merged) {
      expect(m.eloRating).toBe(1000)
      expect(m.timesRanked).toBe(0)
    }
  })

  it('defaults movies to skipped: false', () => {
    const merged = mergeWithLocalState(STATIC_MOVIES)
    for (const m of merged) {
      expect(m.skipped).toBe(false)
    }
  })
})

describe('markSkipped / unmarkSkipped', () => {
  it('marks a movie skipped, persisted across calls', () => {
    markSkipped('2')
    const merged = mergeWithLocalState(STATIC_MOVIES)
    const byId = new Map(merged.map((m) => [m.id, m]))
    expect(byId.get('1').skipped).toBe(false)
    expect(byId.get('2').skipped).toBe(true)
  })

  it('unmarks a previously skipped movie', () => {
    markSkipped('2')
    unmarkSkipped('2')
    expect(mergeWithLocalState(STATIC_MOVIES).find((m) => m.id === '2').skipped).toBe(false)
  })

  it('survives resetLocalState (skip is independent of elo/timesRanked reset)', () => {
    markSkipped('1')
    applyRankToLocalState(mergeWithLocalState(STATIC_MOVIES))
    resetLocalState(['1', '2', '3'])

    const merged = mergeWithLocalState(STATIC_MOVIES)
    const byId = new Map(merged.map((m) => [m.id, m]))
    expect(byId.get('1').timesRanked).toBe(0)
    expect(byId.get('1').skipped).toBe(true)
  })
})

describe('applyRankToLocalState', () => {
  it('updates elo and timesRanked, persisted across calls', () => {
    const pack = mergeWithLocalState(STATIC_MOVIES)
    applyRankToLocalState(pack)

    const merged = mergeWithLocalState(STATIC_MOVIES)
    const byId = new Map(merged.map((m) => [m.id, m]))
    expect(byId.get('1').timesRanked).toBe(1)
    expect(byId.get('1').eloRating).toBeGreaterThan(1000)
    expect(byId.get('3').eloRating).toBeLessThan(1000)

    applyRankToLocalState(mergeWithLocalState(STATIC_MOVIES))
    expect(mergeWithLocalState(STATIC_MOVIES).find((m) => m.id === '1').timesRanked).toBe(2)
  })
})

describe('resetLocalState', () => {
  it('clears only the given movie ids back to defaults', () => {
    applyRankToLocalState(mergeWithLocalState(STATIC_MOVIES))
    resetLocalState(['1', '2'])

    const merged = mergeWithLocalState(STATIC_MOVIES)
    const byId = new Map(merged.map((m) => [m.id, m]))
    expect(byId.get('1').timesRanked).toBe(0)
    expect(byId.get('2').timesRanked).toBe(0)
    expect(byId.get('3').timesRanked).toBe(1)
  })
})
