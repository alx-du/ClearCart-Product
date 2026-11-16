// What a search tells us about a product we haven't researched: its brand,
// material, country of origin, maker and category. Read from the visitor's
// own words and, when allowed, one Tavily search, using text patterns only —
// no model. Results are cached per query, and the total number of Tavily
// searches per day is capped.

import { findOrganizationsIn, findSitesIn, getOrganization, normalize } from './catalogue.js'
import { loadStore, saveStore } from './runtimeStore.js'
import { searchListings } from './tavilySearch.js'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DAILY_WEB_LIMIT = Number(process.env.TAVILY_DAILY_LIMIT) || 200

const FIBRES = [
  'cotton', 'polyester', 'nylon', 'polyamide', 'wool', 'merino', 'cashmere', 'silk', 'linen', 'hemp',
  'viscose', 'rayon', 'modal', 'lyocell', 'acrylic', 'elastane', 'spandex', 'leather', 'down',
]

// Category → the names risk lists use for goods made in that country.
export const CATEGORY_GOODS = {
  apparel: ['Garments'],
  footwear: ['Footwear'],
  electronics: ['Electronics'],
}

const CATEGORY_KEYWORDS = {
  apparel: [
    'hoodie', 'sweatshirt', 'shirt', 'tshirt', 'tee', 'jacket', 'coat', 'jeans', 'trousers', 'pants',
    'shorts', 'joggers', 'dress', 'skirt', 'sweater', 'jumper', 'fleece', 'socks', 'leggings', 'blouse',
  ],
  footwear: ['shoes', 'shoe', 'sneakers', 'trainers', 'boots', 'sandals', 'loafers'],
  electronics: ['phone', 'smartphone', 'laptop', 'headphones', 'earbuds', 'tablet', 'charger', 'tv', 'television'],
}

const COUNTRY_ALIASES = {
  usa: 'United States',
  'the usa': 'United States',
  us: 'United States',
  uk: 'United Kingdom',
  'viet nam': 'Vietnam',
  'p r c': 'China',
}

// Every country name Node knows, normalized, longest first so "south africa"
// wins over a shorter match.
const COUNTRIES = (() => {
  const names = new Intl.DisplayNames(['en'], { type: 'region' })
  const found = new Map(Object.entries(COUNTRY_ALIASES))
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const a of letters) {
    for (const b of letters) {
      const code = a + b
      if (['EU', 'EZ', 'UN', 'QO', 'ZZ'].includes(code)) continue
      let name
      try {
        name = names.of(code)
      } catch {
        continue
      }
      if (name && name !== code && !/unknown/i.test(name)) found.set(normalize(name), name)
    }
  }
  return [...found.entries()].sort((x, y) => y[0].length - x[0].length)
})()

const cache = loadStore('web-lookups')
let webSearchesToday = { date: '', count: 0 }

function mostCommon(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function findCategory(text) {
  const words = new Set(normalize(text).split(' '))
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => words.has(keyword))) return category
  }
  return null
}

function findMaterials(text) {
  const materials = []
  const pattern = new RegExp(`(\\d{1,3})\\s*%\\s*(organic |recycled )?(${FIBRES.join('|')})\\b`, 'gi')
  for (const match of text.matchAll(pattern)) {
    const percent = Number(match[1])
    if (percent > 0 && percent <= 100) {
      materials.push({ percent, material: `${(match[2] ?? '').toLowerCase()}${match[3].toLowerCase()}` })
    }
  }
  const total = materials.reduce((sum, material) => sum + material.percent, 0)
  return total > 0 && total <= 100 ? materials : []
}

function findOrigins(text) {
  const origins = []
  for (const match of normalize(text).matchAll(/\bmade in (?:the )?([a-z ]{2,40})/g)) {
    const after = `${match[1]} `
    const country = COUNTRIES.find(([name]) => after.startsWith(`${name} `))
    if (country) origins.push(country[1])
  }
  return origins
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function brandFrom(text) {
  return findOrganizationsIn(text, { types: ['brand'] })[0] ?? null
}

function makersFrom(text) {
  const orgIds = findOrganizationsIn(text, { types: ['contract_manufacturer', 'supplier'] }).map((org) => org.id)
  const siteIds = findSitesIn(text).map((site) => site.id)
  return { orgIds, siteIds }
}

// What the visitor's own words tell us.
function observeQuery(query) {
  const brand = brandFrom(query)
  const makers = makersFrom(query)
  return {
    listings: 0,
    brandId: brand?.id ?? null,
    category: findCategory(query),
    materials: [],
    origin: null,
    makerOrgIds: makers.orgIds,
    makerSiteIds: makers.siteIds,
  }
}

function observeListings(query, results) {
  const fromQuery = observeQuery(query)
  const titles = results.map((result) => `${result.title} ${hostOf(result.url)}`).join(' | ')
  const contents = results.map((result) => (typeof result.content === 'string' ? result.content : ''))
  // The listing with the fullest composition wins, not a blend of several.
  const materials = contents.map(findMaterials).sort((a, b) => b.length - a.length)[0] ?? []
  const makers = makersFrom(contents.join(' | '))

  return {
    listings: results.length,
    brandId: fromQuery.brandId ?? brandFrom(titles)?.id ?? null,
    category: fromQuery.category ?? findCategory(titles),
    materials,
    origin: mostCommon(contents.flatMap(findOrigins)),
    makerOrgIds: [...new Set([...fromQuery.makerOrgIds, ...makers.orgIds])],
    makerSiteIds: [...new Set([...fromQuery.makerSiteIds, ...makers.siteIds])],
  }
}

function takeDailyWebSearch() {
  const today = new Date().toISOString().slice(0, 10)
  if (webSearchesToday.date !== today) webSearchesToday = { date: today, count: 0 }
  if (webSearchesToday.count >= DAILY_WEB_LIMIT) return false
  webSearchesToday.count += 1
  return true
}

// Returns { observations, source, note? }. source: "cache" | "web" | "query".
// `allowWeb()` is asked only when a Tavily search would actually happen, so a
// cache hit never uses up the visitor's allowance.
export async function observeProduct(query, { allowWeb }) {
  const key = normalize(query)
  const cached = cache[key]
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { observations: cached.observations, source: 'cache' }
  }

  const apiKey = process.env.TAVILY_API_KEY?.trim()
  if (!apiKey || process.env.DEMO_MODE === 'true') {
    return { observations: observeQuery(query), source: 'query' }
  }
  if (!allowWeb() || !takeDailyWebSearch()) {
    return { observations: observeQuery(query), source: 'query', note: 'limit' }
  }

  try {
    const results = await searchListings(query, apiKey)
    const observations = observeListings(query, results)
    cache[key] = { at: Date.now(), observations }
    saveStore('web-lookups', cache)
    return { observations, source: 'web' }
  } catch (error) {
    console.warn('Web lookup failed; using the search text only:', error.message)
    return { observations: observeQuery(query), source: 'query', note: 'error' }
  }
}

export function describeObservations({ observations, source }) {
  const brand = observations.brandId ? getOrganization(observations.brandId) : null
  return {
    source,
    listings: observations.listings,
    brand: brand ? { id: brand.id, name: brand.name, demo: Boolean(brand.demo) } : null,
    category: observations.category,
    materials: observations.materials,
    origin: observations.origin,
  }
}
