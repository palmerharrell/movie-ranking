import { describe, it, expect } from 'vitest'
import { isMarvelOrDc, isComicBook } from './comicBookMovies.js'

function movie(overrides) {
  return { id: 'm', keywords: [], ...overrides }
}

describe('isMarvelOrDc', () => {
  it('matches movies produced by Marvel Studios', () => {
    expect(isMarvelOrDc(movie({ studio: 'Marvel Studios' }))).toBe(true)
  })

  it('matches a curated Marvel/DC collection', () => {
    expect(isMarvelOrDc(movie({ collection: 'The Avengers Collection' }))).toBe(true)
    expect(isMarvelOrDc(movie({ collection: 'Batman Collection' }))).toBe(true)
  })

  it('matches a hardcoded tmdbId exception', () => {
    expect(isMarvelOrDc(movie({ tmdbId: 141052 }))).toBe(true) // Justice League (2017)
  })

  it('does not match an unrelated collection', () => {
    expect(isMarvelOrDc(movie({ collection: 'Blade Runner Collection' }))).toBe(false)
  })

  it('does not match a movie with no matching signal', () => {
    expect(isMarvelOrDc(movie({ studio: 'Warner Bros. Pictures', collection: null }))).toBe(false)
  })
})

describe('isComicBook', () => {
  it('includes every Marvel/DC movie', () => {
    expect(isComicBook(movie({ studio: 'Marvel Studios' }))).toBe(true)
  })

  it('also includes non-Marvel/DC movies tagged with the superhero keyword', () => {
    expect(isComicBook(movie({ keywords: ['superhero'] }))).toBe(true)
  })

  it('excludes a movie with neither signal', () => {
    expect(isComicBook(movie({ keywords: ['heist'] }))).toBe(false)
  })
})
