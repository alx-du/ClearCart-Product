// The product catalogue: what ClearCart has researched, read from
// server/data/catalogue.json at startup. Facts and gaps hang off whatever they
// are about (a product, a site, an organization); a product picks up its
// sites' and organizations' facts through its supply-chain nodes and its brand
// (sandbox/product-entry-example.txt §9). Nothing here calls a model.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describeProduct } from './descriptions.js'

const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data')

export const DIMENSIONS = ['planet', 'people', 'quality', 'value', 'transparency']
// Higher is stronger. A fact reached through a node can't come out stronger
// than the node that links it to the product.
const COVERAGE_RANK = { unknown: 0, claimed: 1, inferred: 2, scored: 3 }

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(dataDirectory, name), 'utf8'))
}

function indexById(rows) {
  return new Map(rows.map((row) => [row.id, row]))
}

const data = loadJson('catalogue.json')
const risk = loadJson('risk-reference.json')

const products = indexById(data.products)
const organizations = indexById(data.organizations)
const sites = indexById(data.sites)
const sources = indexById([...data.sources, ...risk.sources])
const contributors = indexById(data.contributors)
const assessments = new Map(data.assessments.map((assessment) => [assessment.product, assessment]))

export function normalize(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(text) {
  return normalize(text).split(' ').filter(Boolean)
}

export function weakerCoverage(a, b) {
  return COVERAGE_RANK[a] <= COVERAGE_RANK[b] ? a : b
}

// "products:a,b" scopes list the only products a fact applies to.
function scopeApplies(scope, productId, node) {
  if (scope === 'whole_site' || scope === 'whole_org') return true
  if (scope === 'product') return false
  if (scope.startsWith('line:')) return Boolean(node) && node.line === scope.slice(5)
  if (scope.startsWith('products:')) return Boolean(productId) && scope.slice(9).split(',').includes(productId)
  return false
}

function isCurrent(node, today) {
  return (!node.validFrom || node.validFrom <= today) && (!node.validTo || node.validTo > today)
}

function describeSource(id) {
  const source = sources.get(id)
  return source ? { title: source.title, url: source.url, tier: source.tier, publisher: source.publisher } : null
}

function describeContributor(id) {
  const contributor = id ? contributors.get(id) : null
  return contributor ? { id: contributor.id, handle: contributor.handle, platform: contributor.platform } : null
}

function describeFact(fact, { coverage = fact.coverage, via = null } = {}) {
  return {
    id: fact.id,
    statement: fact.statement,
    dimension: fact.dimension,
    coverage,
    validAsOf: fact.validAsOf,
    via,
    sources: fact.sources.map(describeSource).filter(Boolean),
    contributor: describeContributor(fact.contributor),
  }
}

function describeGap(gap, via = null) {
  return {
    id: gap.id,
    missing: gap.missing,
    dimension: gap.dimension,
    tier: gap.tier,
    searchedAt: gap.searchedAt,
    whereLooked: gap.whereLooked,
    via,
  }
}

function factsAbout(subject) {
  return data.facts.filter((fact) => fact.subject === subject)
}

function gapsAbout(subject) {
  return data.gaps.filter((gap) => gap.subject === subject)
}

// The brand, then its parent, and so on up.
function ownershipChain(orgId) {
  const chain = []
  const seen = new Set()
  for (let org = organizations.get(orgId); org && !seen.has(org.id); org = organizations.get(org.parent)) {
    seen.add(org.id)
    chain.push(org)
  }
  return chain
}

export function currentNodes(productId, today = new Date().toISOString().slice(0, 10)) {
  return data.nodes.filter((node) => node.product === productId && isCurrent(node, today))
}

// Every fact and gap that applies to one product (sandbox §9).
export function collectForProduct(productId, today = new Date().toISOString().slice(0, 10)) {
  const product = products.get(productId)
  const facts = new Map()
  const gaps = new Map()
  const add = (fact, options) => {
    const existing = facts.get(fact.id)
    // Reached twice (one site, two nodes): keep the stronger route.
    if (!existing || COVERAGE_RANK[options.coverage] > COVERAGE_RANK[existing.coverage]) {
      facts.set(fact.id, describeFact(fact, options))
    }
  }

  for (const fact of factsAbout(productId)) add(fact, { coverage: fact.coverage })
  for (const gap of gapsAbout(productId)) gaps.set(gap.id, describeGap(gap))

  for (const node of currentNodes(productId, today)) {
    const site = sites.get(node.site)
    if (!site) continue
    const reached = [
      [site.id, `${site.name}, which does its ${node.role.toLowerCase()}`],
      [site.org, organizations.get(site.org)?.name],
    ]
    for (const [subject, via] of reached) {
      if (!subject) continue
      for (const fact of factsAbout(subject)) {
        if (!scopeApplies(fact.scope, productId, node)) continue
        // An audit from before the product was made there doesn't count.
        if (node.validFrom && fact.validAsOf && fact.validAsOf < node.validFrom) continue
        add(fact, { coverage: weakerCoverage(fact.coverage, node.coverage), via })
      }
      for (const gap of gapsAbout(subject)) gaps.set(gap.id, describeGap(gap, via))
    }
  }

  for (const org of ownershipChain(product.brand)) {
    for (const fact of factsAbout(org.id)) {
      if (scopeApplies(fact.scope, productId, null)) add(fact, { coverage: fact.coverage, via: org.name })
    }
    for (const gap of gapsAbout(org.id)) gaps.set(gap.id, describeGap(gap, org.name))
  }

  return { facts: [...facts.values()], gaps: [...gaps.values()] }
}

function summarizeProduct(product) {
  return { id: product.id, name: product.name, brand: organizations.get(product.brand)?.name ?? null }
}

export function listProducts({ brandId = null } = {}) {
  return data.products.filter((product) => !brandId || product.brand === brandId).map(summarizeProduct)
}

export function getBrand(id) {
  const org = organizations.get(id)
  return org?.type === 'brand' ? { id: org.id, name: org.name, demo: Boolean(org.demo) } : null
}

// Typeahead-style matching: each query word may be the start of a word in a
// product's name, aliases, brand or product line.
export function searchCatalogue(query) {
  const queryTokens = tokens(query)
  if (queryTokens.length === 0) return { products: [], brands: [] }
  const normalizedQuery = queryTokens.join(' ')

  const matchedProducts = []
  for (const product of data.products) {
    const brand = organizations.get(product.brand)
    const haystack = new Set(
      [product.name, product.productLine, ...product.aliases, brand?.name ?? '', ...(brand?.aliases ?? [])].flatMap(tokens),
    )
    const matched = queryTokens.filter((token) => [...haystack].some((word) => word.startsWith(token)))
    if (matched.length === 0) continue
    const exact = [product.name, ...product.aliases].some((name) => normalize(name) === normalizedQuery)
    matchedProducts.push({ ...summarizeProduct(product), exact, score: matched.length / queryTokens.length + (exact ? 1 : 0) })
  }
  matchedProducts.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  const brands = data.organizations
    .filter((org) => org.type === 'brand')
    .filter((org) => {
      const names = [org.name, ...org.aliases].map(normalize)
      // The brand's whole name appears in the query, or the query is the start of it.
      return names.some((name) => ` ${normalizedQuery} `.includes(` ${name} `) || name.startsWith(normalizedQuery))
    })
    .map((org) => ({
      id: org.id,
      name: org.name,
      parent: organizations.get(org.parent)?.name ?? null,
      productCount: data.products.filter((product) => product.brand === org.id).length,
    }))

  return {
    products: matchedProducts.slice(0, 8).map(({ score: _score, ...product }) => product),
    brands,
  }
}

export function findExactProduct(query) {
  const normalizedQuery = normalize(query)
  return data.products.find((product) => [product.name, ...product.aliases].some((name) => normalize(name) === normalizedQuery)) ?? null
}

// Brands (and other organizations) whose name or alias appears in the text.
export function findOrganizationsIn(text, { types = null } = {}) {
  const haystack = ` ${normalize(text)} `
  return data.organizations.filter(
    (org) =>
      (!types || types.includes(org.type)) &&
      [org.name, ...org.aliases].some((name) => normalize(name) && haystack.includes(` ${normalize(name)} `)),
  )
}

export function findSitesIn(text) {
  const haystack = ` ${normalize(text)} `
  return data.sites.filter((site) =>
    [site.name, ...site.aliases].some((name) => normalize(name) && haystack.includes(` ${normalize(name)} `)),
  )
}

function describeChain(productId, gaps) {
  const nodes = currentNodes(productId)
  return [1, 2, 3, 4].map((tier) => ({
    tier,
    steps: nodes
      .filter((node) => node.tier === tier)
      .map((node) => {
        const site = sites.get(node.site)
        return {
          role: node.role,
          site: site?.name ?? null,
          country: site?.country ?? null,
          coverage: node.coverage,
          sources: node.sources.map(describeSource).filter(Boolean),
          contributor: describeContributor(node.contributor),
          alsoMakes: data.nodes
            .filter((other) => other.site === node.site && other.product !== productId && isCurrent(other, new Date().toISOString().slice(0, 10)))
            .map((other) => products.get(other.product)?.name)
            .filter((name, index, names) => name && names.indexOf(name) === index),
        }
      }),
    gaps: gaps.filter((gap) => gap.tier === tier),
  }))
}

function describeMaterials(productId) {
  return data.materials
    .filter((material) => material.product === productId)
    .map((material) => ({
      material: material.material,
      percent: material.percent,
      recycledPercent: material.recycledPercent,
      coverage: material.coverage,
    }))
}

// Everything the product page shows, with its summaries and conclusion
// (descriptions.js). Null if the id is unknown.
export function getProductView(productId) {
  const product = products.get(productId)
  if (!product) return null

  const { facts, gaps } = collectForProduct(productId)
  const assessment = assessments.get(productId) ?? null
  const chain = ownershipChain(product.brand)
  const nodeContributors = currentNodes(productId).map((node) => node.contributor)
  const contributorIds = new Set(
    [...data.facts.filter((fact) => facts.some((f) => f.id === fact.id)).map((fact) => fact.contributor), ...nodeContributors].filter(Boolean),
  )
  const sourceKeys = new Set(facts.flatMap((fact) => fact.sources.map((source) => source.url)))

  return describeProduct({
    id: product.id,
    name: product.name,
    brand: chain[0] ? { id: chain[0].id, name: chain[0].name } : null,
    owners: chain.slice(1).map((org) => org.name),
    demo: Boolean(product.demo),
    materials: describeMaterials(productId),
    reviewedAt: assessment?.reviewedAt ?? null,
    dimensions: DIMENSIONS.map((key) => ({
      key,
      score: assessment?.dimensions[key]?.score ?? null,
      coverage: assessment?.dimensions[key]?.coverage ?? 'unknown',
      facts: facts.filter((fact) => fact.dimension === key),
      gaps: gaps.filter((gap) => gap.dimension === key),
    })),
    chain: describeChain(productId, gaps),
    contributors: [...contributorIds].map((id) => contributors.get(id)).filter(Boolean),
    counts: { facts: facts.length, sources: sourceKeys.size, contributors: contributorIds.size },
    siblings: data.products
      .filter((other) => other.brand === product.brand && other.id !== productId)
      .map(summarizeProduct),
  })
}

// --- Pieces the lookup ladder (lookupLadder.js) builds a related page from ---

// Facts and gaps about an organization that apply to everything it makes or sells.
export function orgWideKnowledge(orgId, cap) {
  return {
    facts: factsAbout(orgId)
      .filter((fact) => fact.scope === 'whole_org')
      .map((fact) => describeFact(fact, { coverage: weakerCoverage(fact.coverage, cap) })),
    gaps: gapsAbout(orgId).map((gap) => describeGap(gap)),
  }
}

export function siteWideKnowledge(siteId, cap) {
  return {
    facts: factsAbout(siteId)
      .filter((fact) => fact.scope === 'whole_site')
      .map((fact) => describeFact(fact, { coverage: weakerCoverage(fact.coverage, cap) })),
    gaps: gapsAbout(siteId).map((gap) => describeGap(gap)),
  }
}

export function getOrganization(id) {
  return organizations.get(id) ?? null
}

export function getSite(id) {
  return sites.get(id) ?? null
}

export { ownershipChain }

// Where a brand's researched products are currently sewn/assembled (tier 1).
export function brandAssemblySites(brandId) {
  const bySite = new Map()
  for (const product of data.products.filter((p) => p.brand === brandId)) {
    for (const node of currentNodes(product.id).filter((n) => n.tier === 1)) {
      const entry = bySite.get(node.site) ?? { siteId: node.site, products: [] }
      entry.products.push(product.name)
      bySite.set(node.site, entry)
    }
  }
  return [...bySite.values()]
}

export function sitesOfOrganization(orgId) {
  return data.sites.filter((site) => site.org === orgId).map((site) => site.id)
}

export const riskListLoaded = risk.rows.length > 0

export function riskRowsFor({ goods, country }) {
  if (!country) return []
  const wanted = new Set(goods.map(normalize))
  return risk.rows
    .filter((row) => wanted.has(normalize(row.good)) && normalize(row.country) === normalize(country))
    .map((row) => ({ ...row, source: describeSource(row.source) }))
}
