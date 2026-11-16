import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  findExactProduct,
  getBrand,
  getProductView,
  listProducts,
  riskListLoaded,
  searchCatalogue,
} from './lib/catalogue.js'
import { buildRelated } from './lib/lookupLadder.js'
import { createLimiter } from './lib/rateLimit.js'
import { addRequest, getRequestCount } from './lib/researchRequests.js'
import { describeObservations, observeProduct } from './lib/webLookup.js'

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const frontendDirectory = path.resolve(serverDirectory, '../dist')

// Browser origins allowed to call the API cross-origin, e.g. the GitHub Pages
// site. Not needed when the frontend is served from this server or via Vite.
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

// Per-visitor allowances. Web lookups cost a Tavily credit (cache hits are free
// and don't count); research requests are free but shouldn't be spammable.
const webLookupLimiter = createLimiter({ limit: 15, windowMs: 60 * 60 * 1000 })
const requestLimiter = createLimiter({ limit: 30, windowMs: 60 * 60 * 1000 })

const app = express()
// Behind a proxy or tunnel (e.g. Cloudflare), set TRUST_PROXY so req.ip is
// the visitor's address rather than the proxy's.
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY)

app.use((req, res, next) => {
  const origin = req.get('origin')
  if (origin && CORS_ORIGINS.includes(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    })
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})
app.use(express.json())

function readQuery(value) {
  return typeof value === 'string' ? value.trim().slice(0, 200) : ''
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/catalogue/search', (req, res) => {
  res.json({ status: 'ok', ...searchCatalogue(readQuery(req.query.q)) })
})

app.get('/api/catalogue/products', (req, res) => {
  const brandId = readQuery(req.query.brand) || null
  const brand = brandId ? getBrand(brandId) : null
  if (brandId && !brand) {
    res.status(404).json({ status: 'error', message: 'Brand not found' })
    return
  }
  res.json({ status: 'ok', brand, products: listProducts({ brandId }) })
})

app.get('/api/catalogue/products/:id', (req, res) => {
  const product = getProductView(req.params.id)
  if (!product) {
    res.status(404).json({ status: 'error', message: 'Product not found' })
    return
  }
  res.json({ status: 'ok', product })
})

// A product the catalogue doesn't have: what we know from related records.
// A GET, though it may record a cache entry: it reads, and a GET skips the
// cross-origin preflight.
app.get('/api/lookup', async (req, res) => {
  const query = readQuery(req.query.q)
  if (!query) {
    res.status(400).json({ status: 'error', message: 'query is required' })
    return
  }

  const exact = findExactProduct(query)
  if (exact) {
    res.json({ status: 'ok', kind: 'product', productId: exact.id })
    return
  }

  const observed = await observeProduct(query, { allowWeb: () => webLookupLimiter(req.ip) })
  res.json({
    status: 'ok',
    kind: 'related',
    query,
    observed: describeObservations(observed),
    note: observed.note ?? null,
    ...buildRelated(observed.observations, { riskListLoaded }),
    requestCount: getRequestCount(query),
  })
})

app.post('/api/requests', (req, res) => {
  const query = readQuery(req.body?.query)
  if (!query) {
    res.status(400).json({ status: 'error', message: 'query is required' })
    return
  }
  if (!requestLimiter(req.ip)) {
    res.status(429).json({ status: 'error', message: 'Too many requests. Please try again later.' })
    return
  }
  res.json({ status: 'ok', count: addRequest(query) })
})

app.use(express.static(frontendDirectory))
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(frontendDirectory, 'index.html'))
})

const PORT = process.env.PORT || 8787
app.listen(PORT, () => {
  console.log(`ClearCart API listening on http://localhost:${PORT}`)
})
