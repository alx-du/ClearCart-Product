import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { searchAmazonProductUrls } from './lib/braveSearch.js'
import { invokeFoundryAgent } from './lib/foundryAgent.js'
import { findProduct } from './lib/productLookup.js'

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
