import { describe, expect, it, vi } from 'vitest'
import { fetchCategoryAvoidingDuplicateLabel } from './packQueue.js'

const RANDOM_FIVE = { label: 'Random Five', movies: [] }
const NINETIES = { label: '90s Movies', movies: [] }
const OTHER = { label: 'Directed by Wes Anderson', movies: [] }

describe('fetchCategoryAvoidingDuplicateLabel', () => {
  it('returns the pack unchanged when its label is not already in the queue', async () => {
    const fetchCategory = vi.fn().mockResolvedValue(RANDOM_FIVE)
    const pack = await fetchCategoryAvoidingDuplicateLabel(fetchCategory, [])
    expect(pack).toBe(RANDOM_FIVE)
    expect(fetchCategory).toHaveBeenCalledTimes(1)
  })

  it('re-rolls a Random Five duplicate', async () => {
    const fetchCategory = vi.fn().mockResolvedValueOnce(RANDOM_FIVE).mockResolvedValueOnce(OTHER)
    const pack = await fetchCategoryAvoidingDuplicateLabel(fetchCategory, ['Random Five'])
    expect(pack).toBe(OTHER)
    expect(fetchCategory).toHaveBeenCalledTimes(2)
  })

  it('re-rolls a duplicate attribute-based category label (e.g. "90s Movies")', async () => {
    const fetchCategory = vi.fn().mockResolvedValueOnce(NINETIES).mockResolvedValueOnce(OTHER)
    const pack = await fetchCategoryAvoidingDuplicateLabel(fetchCategory, ['90s Movies'])
    expect(pack).toBe(OTHER)
    expect(fetchCategory).toHaveBeenCalledTimes(2)
  })

  it('gives up after the retry cap and returns the duplicate rather than looping forever', async () => {
    const fetchCategory = vi.fn().mockResolvedValue(NINETIES)
    const pack = await fetchCategoryAvoidingDuplicateLabel(fetchCategory, ['90s Movies'])
    expect(pack).toBe(NINETIES)
    expect(fetchCategory).toHaveBeenCalledTimes(6)
  })
})
