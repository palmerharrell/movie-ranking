import { describe, it, expect } from 'vitest'
import { applyThemeWording } from './labelWording.js'

describe('applyThemeWording', () => {
  it('swaps whole-word Movies/Movie to Films/Film under the classic theme', () => {
    expect(applyThemeWording('80s Adventure Movies', 'classic')).toBe('80s Adventure Films')
    expect(applyThemeWording('Movie Night', 'classic')).toBe('Film Night')
  })

  it('leaves the label unchanged under the neon theme', () => {
    expect(applyThemeWording('80s Adventure Movies', 'neon')).toBe('80s Adventure Movies')
  })

  it('does not mangle substrings that merely contain the word', () => {
    expect(applyThemeWording('Movies starring Moviestar Jones', 'classic')).toBe(
      'Films starring Moviestar Jones',
    )
  })

  it('keeps "Random Five" under the classic theme', () => {
    expect(applyThemeWording('Random Five', 'classic')).toBe('Random Five')
  })

  it('shortens "Random Five" to "Random 5" under neon and family themes', () => {
    expect(applyThemeWording('Random Five', 'neon')).toBe('Random 5')
    expect(applyThemeWording('Random Five', 'family')).toBe('Random 5')
  })
})
