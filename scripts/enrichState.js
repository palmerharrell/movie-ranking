import fs from 'node:fs'
import { createHash } from 'node:crypto'

// Content hash for a source file (#385) — enrich-sources.js's --changed-only
// mode compares this against what's recorded in state to decide whether a
// source needs re-enriching, rather than tracking mtime (which changes on
// every checkout/rsync regardless of actual content).
export function hashFile(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

// { [sourceFilename]: hash } for every source file already processed, or {}
// if the state file doesn't exist yet or is corrupt — a scheduled job
// starting fresh (or recovering from a bad write) should just treat
// everything as unprocessed rather than crash.
export function loadState(stateFilePath) {
  if (!fs.existsSync(stateFilePath)) return {}
  try {
    return JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'))
  } catch {
    return {}
  }
}

export function saveState(stateFilePath, state) {
  fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2) + '\n')
}
