// Small JSON files the server writes while running (search cache, research
// requests), kept in server/data/runtime/ and out of git. Writes go to a temp
// file first so a crash mid-write never leaves a half-written file.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const runtimeDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/runtime')

export function loadStore(name) {
  try {
    return JSON.parse(readFileSync(path.join(runtimeDirectory, `${name}.json`), 'utf8'))
  } catch {
    return {}
  }
}

export function saveStore(name, value) {
  try {
    mkdirSync(runtimeDirectory, { recursive: true })
    const file = path.join(runtimeDirectory, `${name}.json`)
    writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2))
    renameSync(`${file}.tmp`, file)
  } catch (error) {
    // Losing a cache entry or a request count isn't worth failing the request over.
    console.warn(`Could not save ${name}:`, error.message)
  }
}
