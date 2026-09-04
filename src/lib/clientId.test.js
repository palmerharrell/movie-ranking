import { beforeEach, describe, it, expect } from 'vitest'
import { getOrCreateClientId } from './clientId.js'

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

describe('getOrCreateClientId', () => {
  it('generates an id on first call and reuses it thereafter', () => {
    const first = getOrCreateClientId()
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(getOrCreateClientId()).toBe(first)
  })
})
