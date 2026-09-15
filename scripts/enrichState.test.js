import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { hashFile, loadState, saveState } from './enrichState.js'

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enrich-state-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('hashFile', () => {
  it('returns the same hash for identical content', () => {
    const fileA = path.join(tmpDir, 'a.json')
    const fileB = path.join(tmpDir, 'b.json')
    fs.writeFileSync(fileA, '[{"title":"Same"}]')
    fs.writeFileSync(fileB, '[{"title":"Same"}]')
    expect(hashFile(fileA)).toBe(hashFile(fileB))
  })

  it('returns a different hash for different content', () => {
    const fileA = path.join(tmpDir, 'a.json')
    const fileB = path.join(tmpDir, 'b.json')
    fs.writeFileSync(fileA, '[{"title":"One"}]')
    fs.writeFileSync(fileB, '[{"title":"Two"}]')
    expect(hashFile(fileA)).not.toBe(hashFile(fileB))
  })
})

describe('loadState', () => {
  it('returns {} when the state file does not exist', () => {
    expect(loadState(path.join(tmpDir, 'missing.json'))).toEqual({})
  })

  it('returns {} when the state file has invalid JSON, rather than throwing', () => {
    const stateFile = path.join(tmpDir, 'state.json')
    fs.writeFileSync(stateFile, 'not valid json')
    expect(loadState(stateFile)).toEqual({})
  })

  it('returns the parsed contents of a valid state file', () => {
    const stateFile = path.join(tmpDir, 'state.json')
    fs.writeFileSync(stateFile, JSON.stringify({ 'afi-top-100.source.json': 'abc123' }))
    expect(loadState(stateFile)).toEqual({ 'afi-top-100.source.json': 'abc123' })
  })
})

describe('saveState / loadState round-trip', () => {
  it('writes state that loadState can read back', () => {
    const stateFile = path.join(tmpDir, 'state.json')
    const state = { 'afi-top-100.source.json': 'abc123', 'top-british.source.json': 'def456' }
    saveState(stateFile, state)
    expect(loadState(stateFile)).toEqual(state)
  })
})
