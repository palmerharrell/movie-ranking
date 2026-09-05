import { describe, it, expect } from 'vitest'
import { formatPackLabel } from './labelWording.js'

describe('formatPackLabel', () => {
  it('shortens "Random Five" to "Random 5"', () => {
    expect(formatPackLabel('Random Five')).toBe('Random 5')
  })

  it('leaves other labels unchanged', () => {
    expect(formatPackLabel('80s Adventure Movies')).toBe('80s Adventure Movies')
    expect(formatPackLabel('Directed by Wes Anderson')).toBe('Directed by Wes Anderson')
  })
})
