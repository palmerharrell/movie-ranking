import { describe, it, expect } from 'vitest'
import { sourceIdFromFilename, upsertSourceMovie, upsertPersonalMovie } from './mergeSourceMovie.js'

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

describe('upsertPersonalMovie', () => {
  it('adds a new movie keyed by its Letterboxd URI when not already in the pool', () => {
    const result = upsertPersonalMovie([], { tmdbId: 42, title: 'Die Hard' }, 'https://boxd.it/abc')
    expect(result).toEqual([
      { id: 'https://boxd.it/abc', tmdbId: 42, title: 'Die Hard', sources: ['personal'] },
    ])
  })

  it('refreshes fields on an existing entry matched by tmdbId, keeping its id and unioning sources', () => {
    const pool = [
      { id: '42', tmdbId: 42, title: 'Die Hard', posterUrl: 'old.jpg', sources: ['top-80s-action'] },
    ]
    const result = upsertPersonalMovie(
      pool,
      { tmdbId: 42, title: 'Die Hard', posterUrl: 'new.jpg' },
      'https://boxd.it/abc',
    )
    expect(result).toEqual([
      { id: '42', tmdbId: 42, title: 'Die Hard', posterUrl: 'new.jpg', sources: ['top-80s-action', 'personal'] },
    ])
  })

  it('does not duplicate "personal" in sources if already present', () => {
    const pool = [{ id: 'https://boxd.it/abc', tmdbId: 42, title: 'Die Hard', sources: ['personal'] }]
    const result = upsertPersonalMovie(pool, { tmdbId: 42, title: 'Die Hard' }, 'https://boxd.it/abc')
    expect(result[0].sources).toEqual(['personal'])
  })

  it('never re-keys an existing entry, even a source-only one with no Letterboxd URI', () => {
    const pool = [{ id: '42', tmdbId: 42, title: 'Die Hard', sources: ['top-80s-action'] }]
    const result = upsertPersonalMovie(pool, { tmdbId: 42, title: 'Die Hard' }, 'https://boxd.it/abc')
    expect(result[0].id).toBe('42')
  })

  it('matches a pre-migration entry (no tmdbId yet) by id instead of duplicating it', () => {
    const pool = [{ id: 'https://boxd.it/abc', title: 'Die Hard', sources: ['personal'] }]
    const result = upsertPersonalMovie(pool, { tmdbId: 42, title: 'Die Hard' }, 'https://boxd.it/abc')
    expect(result).toEqual([
      { id: 'https://boxd.it/abc', tmdbId: 42, title: 'Die Hard', sources: ['personal'] },
    ])
  })
})
