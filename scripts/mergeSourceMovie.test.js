import { describe, it, expect } from 'vitest'
import { sourceIdFromFilename, upsertSourceMovie } from './mergeSourceMovie.js'

describe('sourceIdFromFilename', () => {
  it('strips the .source.json suffix', () => {
    expect(sourceIdFromFilename('afi-top-100.source.json')).toBe('afi-top-100')
  })
})

describe('upsertSourceMovie', () => {
  it('adds a new movie keyed by its tmdbId when not already in the pool', () => {
    const result = upsertSourceMovie([], { tmdbId: 42, title: 'Die Hard' }, 'top-80s-action')
    expect(result).toEqual([
      { id: '42', tmdbId: 42, title: 'Die Hard', sources: ['top-80s-action'] },
    ])
  })

  it('appends the source id to an existing entry matched by tmdbId', () => {
    const pool = [
      { id: 'https://boxd.it/abc', tmdbId: 42, title: 'Die Hard', sources: ['personal'] },
    ]
    const result = upsertSourceMovie(pool, { tmdbId: 42, title: 'Die Hard' }, 'top-80s-action')
    expect(result).toEqual([
      { id: 'https://boxd.it/abc', tmdbId: 42, title: 'Die Hard', sources: ['personal', 'top-80s-action'] },
    ])
  })

  it('does not duplicate a source id already present', () => {
    const pool = [
      { id: 'https://boxd.it/abc', tmdbId: 42, title: 'Die Hard', sources: ['personal', 'top-80s-action'] },
    ]
    const result = upsertSourceMovie(pool, { tmdbId: 42, title: 'Die Hard' }, 'top-80s-action')
    expect(result).toBe(pool)
  })

  it('treats a missing sources[] (pre-migration personal entries) as empty', () => {
    const pool = [{ id: 'https://boxd.it/abc', tmdbId: 42, title: 'Die Hard' }]
    const result = upsertSourceMovie(pool, { tmdbId: 42, title: 'Die Hard' }, 'top-80s-action')
    expect(result).toEqual([
      { id: 'https://boxd.it/abc', tmdbId: 42, title: 'Die Hard', sources: ['top-80s-action'] },
    ])
  })

  it('leaves other fields on an existing entry untouched (personal data wins)', () => {
    const pool = [
      { id: 'https://boxd.it/abc', tmdbId: 42, title: 'Die Hard', posterUrl: 'personal-poster.jpg', sources: ['personal'] },
    ]
    const result = upsertSourceMovie(
      pool,
      { tmdbId: 42, title: 'Die Hard', posterUrl: 'source-poster.jpg' },
      'top-80s-action',
    )
    expect(result[0].posterUrl).toBe('personal-poster.jpg')
  })
})
