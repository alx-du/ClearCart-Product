import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { searchAmazonProductUrls } from './lib/braveSearch.js'
import { invokeFoundryAgent } from './lib/foundryAgent.js'
import { findProduct } from './lib/productLookup.js'
import { getCachedResponse, listCachedProductNames } from './lib/responseCache.js'

// When true, a cache miss never falls through to Foundry — useful for demos
// with no Azure credentials available at all. A cache hit skips Foundry
// either way, regardless of this flag.
const DEMO_MODE = process.env.DEMO_MODE === 'true'

// A cache hit is near-instant, which reads as obviously fake next to a real
// Foundry round trip — hold it briefly so demo mode feels consistent.
function simulateThinkingDelay() {
  const delayMs = 900 + Math.random() * 1200
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const frontendDirectory = path.resolve(serverDirectory, '../dist')
const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/chat', async (req, res) => {
  const messages = Array.isArray(req.body?.messages)
    ? req.body.messages
        .filter(
          (message) =>
            (message?.role === 'user' || message?.role === 'assistant') &&
            typeof message.text === 'string' &&
            message.text.trim(),
        )
        .slice(-20)
        .map((message) => ({ role: message.role, text: message.text.trim().slice(0, 8000) }))
    : []

  if (messages.length === 0 || messages.at(-1).role !== 'user') {
    res.status(400).json({ status: 'error', message: 'A user message is required' })
    return
  }

  const cached = getCachedResponse(messages.at(-1).text)
  if (cached) {
    await simulateThinkingDelay()
    res.json({ status: 'ok', ...cached })
    return
  }

  if (DEMO_MODE) {
    await simulateThinkingDelay()
    const available = listCachedProductNames().join(', ')
    res.json({
      status: 'ok',
      reply: `Demo mode only has data for a few products: ${available}. Try one of those.`,
      assessment: null,
    })
    return
  }

  try {
    const result = await invokeFoundryAgent(messages)
    res.json({ status: 'ok', ...result })
  } catch (error) {
    console.error('Foundry agent failed:', error)
    res.status(500).json({ status: 'error', message: 'The assistant could not respond' })
  }
})

app.post('/api/products/search', async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
  if (!query) {
    res.status(400).json({ status: 'error', message: 'query is required' })
    return
  }

  try {
    const candidateUrls = await searchAmazonProductUrls(query)
    const product = candidateUrls.length > 0 ? await findProduct(candidateUrls) : null

    res.json(product ? { status: 'found', product } : { status: 'not_found' })
  } catch (error) {
    console.error('Product search failed:', error)
    res.status(500).json({ status: 'error', message: 'Product search failed' })
  }
})

app.use(express.static(frontendDirectory))
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(frontendDirectory, 'index.html'))
})

const PORT = process.env.PORT || 8787
app.listen(PORT, () => {
  console.log(`ClearCart API listening on http://localhost:${PORT}`)
})
