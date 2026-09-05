import { describe, it, expect } from 'vitest'
import { generateCategory, tryBuildCategory } from './categoryGenerator.js'

// Forces the first random() draw (Tough Choice check) and second draw (Head
// to Head check) above their chance so both are skipped, the third draw
// below RANDOM_FIVE_CHANCE so Random Five triggers, then delegates to a
// seeded PRNG for everything after — so the Random Five branch triggers
// deterministically while the rest of the draw sequence stays reproducible.
function forceRandomFiveThenSeeded(seed) {
  let call = 0
  const seeded = seededRandom(seed)
  return () => {
    call += 1
    if (call === 1) return 0.99
    if (call === 2) return 0.99
    if (call === 3) return 0
    return seeded()
  }
}

// Forces the first three random() draws (Tough Choice, Head to Head, Random
// Five checks) all above their chance so none of the direct branches
// trigger, then delegates to a seeded PRNG.
function skipRandomFiveThenSeeded(seed) {
  let call = 0
  const seeded = seededRandom(seed)
  return () => {
    call += 1
    if (call === 1) return 0.99
    if (call === 2) return 0.99
    if (call === 3) return 0.99
    return seeded()
  }
}

// Forces the first random() draw (Tough Choice check) above its chance so
// it's skipped, the second draw below HEAD_TO_HEAD_CHANCE, then delegates
// to a seeded PRNG for everything after (used to pick the pair).
function forceHeadToHeadThenSeeded(seed) {
  let call = 0
  const seeded = seededRandom(seed)
  return () => {
    call += 1
    if (call === 1) return 0.99
    if (call === 2) return 0
    return seeded()
  }
}

// Forces the first random() draw below TOP_10_TOUGH_CHOICE_CHANCE, then
// delegates to a seeded PRNG for everything after (used to pick the pair).
function forceToughChoiceThenSeeded(seed) {
  let first = true
  const seeded = seededRandom(seed)
  return () => {
    if (first) {
      first = false
      return 0
    }
    return seeded()
  }
}

// Deterministic seeded PRNG (mulberry32) so tests aren't flaky.
function seededRandom(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeMovies() {
  const wesAnderson = ['director-A', 'director-A', 'director-A', 'director-A', 'director-A']
  return [
    { id: '1', title: 'M1', year: 1985, decade: '80s', director: 'director-A', genres: ['Comedy'], cast: ['Actor X'] },
    { id: '2', title: 'M2', year: 1986, decade: '80s', director: 'director-A', genres: ['Comedy'], cast: ['Actor X'] },
    { id: '3', title: 'M3', year: 1987, decade: '80s', director: 'director-A', genres: ['Drama'], cast: ['Actor Y'] },
    { id: '4', title: 'M4', year: 1988, decade: '80s', director: 'director-A', genres: ['Drama'], cast: ['Actor Y'] },
    { id: '5', title: 'M5', year: 1989, decade: '80s', director: 'director-A', genres: ['Comedy'], cast: ['Actor Z'] },
    { id: '6', title: 'M6', year: 1999, decade: '90s', director: 'director-B', genres: ['Action'], cast: ['Actor Z'] },
    { id: '7', title: 'M7', year: 1998, decade: '90s', director: 'director-B', genres: ['Action'], cast: ['Actor Q'] },
  ]
}

describe('generateCategory', () => {
  it('returns a category with exactly 5 movies and a label', () => {
    const movies = makeMovies()
    const result = generateCategory(movies, { random: seededRandom(1) })
    expect(result).not.toBeNull()
    expect(result.movies).toHaveLength(5)
    expect(typeof result.label).toBe('string')
  })

  it('returns null when no attribute has 5+ matches', () => {
    const movies = makeMovies().slice(0, 3) // too few for any grouping to hit 5
    const result = generateCategory(movies, { random: seededRandom(1) })
    expect(result).toBeNull()
  })

  it('falls back to fully random selection when ranked history is below the threshold', () => {
    const movies = makeMovies()
    const isRanked = (m) => m.id === '1'
    const result = generateCategory(movies, {
      isRanked,
      totalRankedCount: 1, // below MIN_RANKED_FOR_OVERLAP
      random: seededRandom(42),
    })
    expect(result).not.toBeNull()
    expect(result.movies).toHaveLength(5)
  })

  it('includes 1-2 ranked movies once ranked history is high enough', () => {
    // 10 movies sharing a director/genre/decade so whichever attribute the
    // generator picks, all 10 match — and there's enough unranked slack
    // (7 of 10) to keep overlap capped at 2.
    const movies = Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      title: `M${i + 1}`,
      year: 1980 + i,
      decade: '80s',
      director: 'director-A',
      genres: ['Comedy'],
      cast: ['Actor X'],
    }))
    const rankedIds = new Set(['1', '2', '3', '4', '5'])
    const isRanked = (m) => rankedIds.has(m.id)

    // Run many seeds to check the overlap constraint holds broadly, not just for one seed.
    for (let seed = 0; seed < 30; seed++) {
      const result = generateCategory(movies, {
        isRanked,
        totalRankedCount: rankedIds.size,
        random: seededRandom(seed),
      })
      if (!result) continue
      const overlapCount = result.movies.filter(isRanked).length
      expect(overlapCount).toBeGreaterThanOrEqual(1)
      expect(overlapCount).toBeLessThanOrEqual(2)
    }
  })

  it('allows more than 2 overlap movies when not-yet-ranked matches run out', () => {
    const movies = makeMovies()
    // Only movie '5' among the director-A group is unranked; rest are ranked.
    const rankedIds = new Set(['1', '2', '3', '4', '6', '7'])
    const isRanked = (m) => rankedIds.has(m.id)

    const result = generateCategory(movies, {
      isRanked,
      totalRankedCount: rankedIds.size,
      random: seededRandom(7),
    })
    expect(result).not.toBeNull()
    expect(result.movies).toHaveLength(5)
  })

  it('never pairs decade with year', () => {
    const movies = makeMovies()
    for (let seed = 0; seed < 300; seed++) {
      const result = tryBuildCategory(movies, seededRandom(seed))
      if (!result || result.picks.length < 2) continue
      const types = result.picks.map((p) => p.type).sort()
      expect(types).not.toEqual(['decade', 'year'])
    }
  })

  it('formats each allowed pair type as specified', () => {
    const movie = {
      year: 1999,
      decade: '90s',
      director: 'Wes Anderson',
      genres: ['Adventure'],
      cast: ['Harrison Ford'],
      studio: 'A24',
      originalLanguage: 'fr',
    }
    const movies = Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), title: `M${i + 1}`, ...movie }))

    const expectedByPair = {
      'decade,genre': '90s Adventure Movies',
      'genre,year': '1999 Adventure Movies',
      'director,genre': 'Wes Anderson Adventure Movies',
      'cast,genre': 'Adventure Movies starring Harrison Ford',
      'decade,director': '90s Wes Anderson Movies',
      'cast,decade': '90s Movies starring Harrison Ford',
      'director,year': '1999 Wes Anderson Movies',
      'cast,year': '1999 Movies starring Harrison Ford',
      'cast,director': 'Wes Anderson Movies starring Harrison Ford',
      'cast,studio': 'A24 Movies starring Harrison Ford',
      'decade,studio': '90s A24 Movies',
      'director,studio': 'A24 Wes Anderson Movies',
      'genre,studio': 'A24 Adventure Movies',
      'studio,year': '1999 A24 Movies',
      'cast,language': 'French Movies starring Harrison Ford',
      'decade,language': '90s French Movies',
      'director,language': 'French Wes Anderson Movies',
      'genre,language': 'French Adventure Movies',
      'language,year': '1999 French Movies',
      'language,studio': 'French A24 Movies',
    }

    const seenPairs = new Set()
    for (let seed = 0; seed < 5000 && seenPairs.size < Object.keys(expectedByPair).length; seed++) {
      const result = tryBuildCategory(movies, seededRandom(seed))
      if (!result || result.picks.length < 2) continue
      const key = result.picks.map((p) => p.type).sort().join(',')
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      expect(result.label).toBe(expectedByPair[key])
    }

    expect(seenPairs.size).toBe(Object.keys(expectedByPair).length)
  })

  it('formats each single-attribute type as specified', () => {
    const movie = {
      year: 1999,
      decade: '1990s',
      director: 'Wes Anderson',
      genres: ['Horror'],
      cast: ['Harrison Ford'],
      studio: 'A24',
      collection: 'Knives Out Collection',
      originalLanguage: 'ja',
      keywords: ['heist'],
    }
    const movies = Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), title: `M${i + 1}`, ...movie }))

    const expectedByType = {
      director: 'Directed by Wes Anderson',
      genre: 'Horror Movies',
      decade: '90s Movies',
      year: 'Movies from 1999',
      cast: 'Movies starring Harrison Ford',
      studio: 'A24 Movies',
      collection: 'Knives Out Movies',
      language: 'Japanese Movies',
      keyword: 'Heist Movies',
    }

    const seenTypes = new Set()
    for (let seed = 0; seed < 2000 && seenTypes.size < Object.keys(expectedByType).length; seed++) {
      const result = tryBuildCategory(movies, seededRandom(seed))
      if (!result || result.picks.length !== 1) continue
      const type = result.picks[0].type
      if (seenTypes.has(type)) continue
      seenTypes.add(type)
      expect(result.label).toBe(expectedByType[type])
    }

    expect(seenTypes.size).toBe(Object.keys(expectedByType).length)
  })

  it('never pairs collection or keyword with another attribute', () => {
    const movie = {
      year: 1999,
      decade: '90s',
      director: 'Wes Anderson',
      genres: ['Adventure'],
      cast: ['Harrison Ford'],
      studio: 'A24',
      collection: 'Knives Out Collection',
      originalLanguage: 'fr',
      keywords: ['heist'],
    }
    const movies = Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), title: `M${i + 1}`, ...movie }))

    for (let seed = 0; seed < 500; seed++) {
      const result = tryBuildCategory(movies, seededRandom(seed))
      if (!result || result.picks.length < 2) continue
      const types = result.picks.map((p) => p.type)
      expect(types).not.toContain('collection')
      expect(types).not.toContain('keyword')
    }
  })

  it('builds a "Random Five" pack when the random-five chance hits', () => {
    const movies = makeMovies()
    const result = generateCategory(movies, { random: forceRandomFiveThenSeeded(1) })
    expect(result).not.toBeNull()
    expect(result.label).toBe('Random Five')
    expect(result.movies).toHaveLength(5)
  })

  it('falls back to "Random Five" when no attribute has 5+ matches but the pool does', () => {
    // Every movie has a unique director/genre/decade/year/cast — no
    // attribute-based category can ever find 5 matches — but the pool has 5
    // movies total, so the fallback should still produce a pack.
    const movies = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      title: `M${i + 1}`,
      year: 1980 + i,
      decade: `${1980 + i}s`,
      director: `director-${i}`,
      genres: [`genre-${i}`],
      cast: [`actor-${i}`],
    }))

    const result = generateCategory(movies, { random: skipRandomFiveThenSeeded(3) })
    expect(result).not.toBeNull()
    expect(result.label).toBe('Random Five')
    expect(result.movies).toHaveLength(5)
  })

  it('builds a "Head to Head" pack when the head-to-head chance hits', () => {
    const movies = Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      title: `M${i + 1}`,
      eloRating: 1000 + i,
    }))
    const isRanked = () => true

    const result = generateCategory(movies, {
      isRanked,
      totalRankedCount: movies.length,
      random: forceHeadToHeadThenSeeded(1),
    })
    expect(result).not.toBeNull()
    expect(result.label).toBe('Head to Head')
    expect(result.type).toBe('head-to-head')
    expect(result.movies).toHaveLength(2)
    expect(result.movies[0].id).not.toBe(result.movies[1].id)
  })

  it('only draws Head to Head movies from ranked movies with a numeric eloRating', () => {
    const movies = [
      ...Array.from({ length: 3 }, (_, i) => ({ id: `ranked-${i}`, title: `R${i}`, eloRating: 1200 })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `unranked-${i}`, title: `U${i}` })),
    ]
    const isRanked = (m) => m.id.startsWith('ranked-')

    for (let seed = 0; seed < 30; seed++) {
      const result = generateCategory(movies, {
        isRanked,
        totalRankedCount: 3,
        random: forceHeadToHeadThenSeeded(seed),
      })
      if (!result || result.type !== 'head-to-head') continue
      for (const m of result.movies) {
        expect(m.id.startsWith('ranked-')).toBe(true)
      }
    }
  })

  it('falls through to a normal pack when fewer than 2 ranked movies are eligible for Head to Head', () => {
    const movies = makeMovies()
    const result = generateCategory(movies, { random: forceHeadToHeadThenSeeded(1) })
    expect(result).not.toBeNull()
    expect(result.type).not.toBe('head-to-head')
    expect(result.movies).toHaveLength(5)
  })

  it('builds a "Top 10 Tough Choice" pack when its chance hits and the ranked threshold is met', () => {
    const movies = Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      title: `M${i + 1}`,
      eloRating: 1000 + i,
    }))
    const isRanked = () => true

    const result = generateCategory(movies, {
      isRanked,
      totalRankedCount: 50,
      random: forceToughChoiceThenSeeded(1),
    })
    expect(result).not.toBeNull()
    expect(result.label).toBe('Top 10 Tough Choice')
    expect(result.type).toBe('head-to-head')
    expect(result.movies).toHaveLength(2)
    expect(result.movies[0].id).not.toBe(result.movies[1].id)
  })

  it('only draws Top 10 Tough Choice movies from the top 10 by eloRating', () => {
    const movies = Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      title: `M${i + 1}`,
      eloRating: 1000 + i, // ids 11-20 hold the top 10 ratings
    }))
    const isRanked = () => true
    const top10Ids = new Set(movies.slice(10).map((m) => m.id))

    for (let seed = 0; seed < 30; seed++) {
      const result = generateCategory(movies, {
        isRanked,
        totalRankedCount: 50,
        random: forceToughChoiceThenSeeded(seed),
      })
      if (!result || result.label !== 'Top 10 Tough Choice') continue
      for (const m of result.movies) {
        expect(top10Ids.has(m.id)).toBe(true)
      }
    }
  })

  it('does not build a Top 10 Tough Choice pack below the ranked-count threshold', () => {
    const movies = Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      title: `M${i + 1}`,
      eloRating: 1000 + i,
    }))
    const isRanked = () => true

    const result = generateCategory(movies, {
      isRanked,
      totalRankedCount: 49,
      random: forceToughChoiceThenSeeded(1),
    })
    expect(result).not.toBeNull()
    expect(result.label).not.toBe('Top 10 Tough Choice')
  })

  it('falls through to a normal pack when fewer than 2 ranked movies are eligible for Top 10 Tough Choice', () => {
    const movies = makeMovies()
    const result = generateCategory(movies, {
      totalRankedCount: 50,
      random: forceToughChoiceThenSeeded(1),
    })
    expect(result).not.toBeNull()
    expect(result.label).not.toBe('Top 10 Tough Choice')
    expect(result.movies).toHaveLength(5)
  })
})
