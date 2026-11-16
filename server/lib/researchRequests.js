// Searches the catalogue couldn't answer, counted so the most-asked-for
// products get researched first.

import { normalize } from './catalogue.js'
import { loadStore, saveStore } from './runtimeStore.js'

const requests = loadStore('requests')

export function getRequestCount(query) {
  return requests[normalize(query)]?.count ?? 0
}

export function addRequest(query) {
  const key = normalize(query)
  if (!key) return 0
  const now = new Date().toISOString()
  const existing = requests[key]
  requests[key] = existing
    ? { ...existing, count: existing.count + 1, lastRequested: now }
    : { query: query.trim().slice(0, 200), count: 1, firstRequested: now, lastRequested: now }
  saveStore('requests', requests)
  return requests[key].count
}
