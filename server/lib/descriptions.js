// The one-line dimension summaries and the conclusion on a product page.
//
// They're written from the product's collected facts and gaps, never typed in
// by hand, so they can't drift from the evidence. A model writes them offline
// (scripts/buildDescriptions.js) and they're cached in
// server/data/descriptions.json under a hash of everything they were written
// from. When the facts change, the hash no longer matches and the page falls
// back to a plain template built from the facts until the build runs again.
// No visitor request ever calls a model.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Bump when the prompt or the input shape changes: every cached description
// then counts as stale.
export const PROMPT_VERSION = 'descriptions-v2'

const CACHE_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/descriptions.json')
const COVERAGE_RANK = { unknown: 0, claimed: 1, inferred: 2, scored: 3 }
const DIMENSION_NAMES = {
  planet: 'planet',
  people: 'people & supply chain',
  quality: 'quality',
  value: 'value',
  transparency: 'transparency',
}

// --- What a description is written from ---------------------------------

function byId(a, b) {
  return a.id.localeCompare(b.id)
}

// `dimension` is one entry of getProductView().dimensions.
export function dimensionInputs(productName, dimension) {
  return {
    kind: 'dimension',
    productName,
    dimension: dimension.key,
    score: dimension.score,
    coverage: dimension.coverage,
    facts: dimension.facts
      .map((fact) => ({
        id: fact.id,
        statement: fact.statement,
        coverage: fact.coverage,
        about: fact.via,
        sourceTypes: [...new Set(fact.sources.map((source) => source.tier))].sort(),
      }))
      .sort(byId),
    gaps: dimension.gaps.map((gap) => ({ id: gap.id, missing: gap.missing })).sort(byId),
  }
}

export function conclusionInputs(productName, dimensions) {
  return {
    kind: 'conclusion',
    productName,
    dimensions: dimensions.map((dimension) => {
      const { kind: _kind, productName: _name, ...rest } = dimensionInputs(productName, dimension)
      return rest
    }),
  }
}

// JSON with keys sorted at every level, so equal inputs always hash equally.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export function hashInputs(inputs) {
  return createHash('sha256').update(canonical({ inputs, promptVersion: PROMPT_VERSION })).digest('hex')
}

// Every fact and gap id a description may cite.
export function citableIds(inputs) {
  const dimensions = inputs.kind === 'conclusion' ? inputs.dimensions : [inputs]
  return new Map(
    dimensions.flatMap((dimension) => [
      ...dimension.facts.map((fact) => [fact.id, fact.coverage]),
      ...dimension.gaps.map((gap) => [gap.id, 'gap']),
    ]),
  )
}

// --- Template text: no model, always available ---------------------------

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function listOf(items) {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

export function templateDimension(inputs) {
  if (inputs.facts.length === 0 && inputs.gaps.length === 0) return 'No evidence recorded yet.'
  const strongest = [...inputs.facts]
    .sort((a, b) => COVERAGE_RANK[b.coverage] - COVERAGE_RANK[a.coverage] || a.id.localeCompare(b.id))
    .slice(0, 2)
    .map((fact) => fact.statement)
  const missing = inputs.gaps.map((gap) => lowerFirst(gap.missing))
  return [...strongest, missing.length > 0 ? `Not public: ${listOf(missing)}.` : null].filter(Boolean).join(' ')
}

export function templateConclusion(inputs) {
  const named = (coverages) =>
    inputs.dimensions.filter((dimension) => coverages.includes(dimension.coverage)).map((d) => DIMENSION_NAMES[d.dimension])
  const strong = named(['scored'])
  const weak = named(['claimed', 'unknown'])
  const missing = [...new Set(inputs.dimensions.flatMap((dimension) => dimension.gaps.map((gap) => lowerFirst(gap.missing))))]

  return [
    strong.length > 0
      ? `Independent evidence covers ${listOf(strong)}.`
      : 'None of the five dimensions has independent evidence yet.',
    weak.length > 0 ? `Little or nothing is confirmed for ${listOf(weak)}.` : null,
    missing.length > 0 ? `Not public: ${listOf(missing.slice(0, 3))}.` : null,
  ]
    .filter(Boolean)
    .join(' ')
}

// --- The cache file --------------------------------------------------------

let cache = { mtimeMs: -1, entries: [] }

// Re-read when the file changes, so a build shows up without a restart.
function cachedEntries() {
  let mtimeMs = 0
  try {
    mtimeMs = statSync(CACHE_FILE).mtimeMs
  } catch {
    return []
  }
  if (mtimeMs !== cache.mtimeMs) {
    try {
      const parsed = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
      cache = { mtimeMs, entries: Array.isArray(parsed.entries) ? parsed.entries : [] }
    } catch (error) {
      console.warn('Could not read descriptions.json:', error.message)
      cache = { mtimeMs, entries: [] }
    }
  }
  return cache.entries
}

// The newest description written from exactly these inputs, if any.
export function findDescription(product, key, inputsHash) {
  return (
    cachedEntries()
      .filter((entry) => entry.product === product && entry.key === key && entry.inputsHash === inputsHash)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0] ?? null
  )
}

// Old entries are kept: they record what a page said before its facts changed.
export function saveDescriptions(newEntries) {
  const entries = [...cachedEntries(), ...newEntries]
  mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
  const body = {
    _about:
      'Generated by `npm run descriptions:build`. Each entry is one dimension summary or conclusion, written by a model from the facts hashed in inputsHash (see server/lib/descriptions.js). Set "reviewed": true after a person has checked an entry. Old entries are kept as history.',
    entries,
  }
  writeFileSync(`${CACHE_FILE}.tmp`, `${JSON.stringify(body, null, 2)}\n`)
  renameSync(`${CACHE_FILE}.tmp`, CACHE_FILE)
  cache.mtimeMs = -1
}

// --- For the product page --------------------------------------------------

function pick(productId, key, inputs, template) {
  const entry = findDescription(productId, key, hashInputs(inputs))
  if (!entry) return { text: template(inputs), origin: 'template' }
  return { text: entry.text, origin: entry.reviewed ? 'reviewed' : 'generated' }
}

// Adds `summary`/`summaryOrigin` to each dimension and a `conclusion`.
export function describeProduct(view) {
  const dimensions = view.dimensions.map((dimension) => {
    const { text, origin } = pick(view.id, dimension.key, dimensionInputs(view.name, dimension), templateDimension)
    return { ...dimension, summary: text, summaryOrigin: origin }
  })
  return {
    ...view,
    dimensions,
    conclusion: pick(view.id, 'conclusion', conclusionInputs(view.name, view.dimensions), templateConclusion),
  }
}
