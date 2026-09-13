import { beforeEach, describe, it, expect } from 'vitest'
import {
  mergeWithLocalState,
  applyRankToLocalState,
  resetLocalState,
  markSkipped,
  unmarkSkipped,
  restoreSkipped,
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

  it('clears eloRating/timesRanked for a movie ranked then skipped (#169)', () => {
    applyRankToLocalState(mergeWithLocalState(STATIC_MOVIES))
    expect(mergeWithLocalState(STATIC_MOVIES).find((m) => m.id === '1').timesRanked).toBe(1)

    markSkipped('1')

    const merged = mergeWithLocalState(STATIC_MOVIES)
    const byId = new Map(merged.map((m) => [m.id, m]))
    expect(byId.get('1').eloRating).toBe(1000)
    expect(byId.get('1').timesRanked).toBe(0)
    expect(byId.get('1').skipped).toBe(true)
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

describe('restoreSkipped', () => {
  it('fully restores a ranked movie skipped via the in-pack undo (#169)', () => {
    applyRankToLocalState(mergeWithLocalState(STATIC_MOVIES))
    const before = mergeWithLocalState(STATIC_MOVIES).find((m) => m.id === '1')

    markSkipped('1')
    restoreSkipped('1', before.eloRating, before.timesRanked)

    const after = mergeWithLocalState(STATIC_MOVIES).find((m) => m.id === '1')
    expect(after.skipped).toBe(false)
    expect(after.eloRating).toBe(before.eloRating)
    expect(after.timesRanked).toBe(before.timesRanked)
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

  // #338 investigation: "is it possible for a movie in a submitted 5-pack to
  // end up unranked?" This is the actual commit path App.jsx's handleRank
  // drives (via api.rankPack -> applyRankToLocalState), so it's the right
  // place to pin the invariant down. `orderedMovies` here is *every* tile in
  // the pack, in whatever drag order the user left them in (including a
  // shrunk 2-4 movie pack after skips, and a full 5) — every single one must
  // come out with timesRanked bumped by exactly one, with no id silently
  // dropped. `elo.js`'s `rankPack` builds its ratings map by id (not array
  // index), and this loop iterates `orderedMovies` itself rather than some
  // derived/filtered list, so there's no code path here that could leave a
  // submitted tile un-ranked.
  it('ranks every tile in the pack, regardless of pack size or drag order (#338)', () => {
    const fiveMovies = [
      { id: '1', title: 'A' },
      { id: '2', title: 'B' },
      { id: '3', title: 'C' },
      { id: '4', title: 'D' },
      { id: '5', title: 'E' },
    ]
    for (const size of [2, 3, 4, 5]) {
      globalThis.localStorage.clear()
      const pack = mergeWithLocalState(fiveMovies.slice(0, size))
      // Reverse the drag order from the default array order to make sure
      // the update isn't accidentally keyed off array position.
      const reversed = [...pack].reverse()
      applyRankToLocalState(reversed)

      const merged = mergeWithLocalState(fiveMovies.slice(0, size))
      for (const movie of merged) {
        expect(movie.timesRanked).toBe(1)
      }
    }
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
