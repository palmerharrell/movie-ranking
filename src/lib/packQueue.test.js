import { describe, expect, it, vi } from 'vitest'
import { fetchCategoryAvoidingDuplicateRandomFive } from './packQueue.js'

const RANDOM_FIVE = { label: 'Random Five', movies: [] }
const OTHER = { label: 'Directed by Wes Anderson', movies: [] }

describe('fetchCategoryAvoidingDuplicateRandomFive', () => {
  it('returns the pack unchanged when the queue has no Random Five yet', async () => {
    const fetchCategory = vi.fn().mockResolvedValue(RANDOM_FIVE)
    const pack = await fetchCategoryAvoidingDuplicateRandomFive(fetchCategory, [])
    expect(pack).toBe(RANDOM_FIVE)
    expect(fetchCategory).toHaveBeenCalledTimes(1)
  })

  it('returns a non-Random-Five pack unchanged regardless of existing queue', async () => {
    const fetchCategory = vi.fn().mockResolvedValue(OTHER)
    const pack = await fetchCategoryAvoidingDuplicateRandomFive(fetchCategory, ['Random Five'])
    expect(pack).toBe(OTHER)
    expect(fetchCategory).toHaveBeenCalledTimes(1)
  })

  it('re-rolls when a duplicate Random Five would land in a queue that already has one', async () => {
    const fetchCategory = vi.fn().mockResolvedValueOnce(RANDOM_FIVE).mockResolvedValueOnce(OTHER)
    const pack = await fetchCategoryAvoidingDuplicateRandomFive(fetchCategory, ['Random Five'])
    expect(pack).toBe(OTHER)
    expect(fetchCategory).toHaveBeenCalledTimes(2)
  })

  it('gives up after the retry cap and returns the duplicate rather than looping forever', async () => {
    const fetchCategory = vi.fn().mockResolvedValue(RANDOM_FIVE)
    const pack = await fetchCategoryAvoidingDuplicateRandomFive(fetchCategory, ['Random Five'])
    expect(pack).toBe(RANDOM_FIVE)
    expect(fetchCategory).toHaveBeenCalledTimes(6)
  })
})
