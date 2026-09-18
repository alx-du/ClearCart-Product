import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { invokeFoundryAgent } from './lib/foundryAgent.js'
import {
  findCachedAssessment,
  getCachedResponse,
  listCachedProductNames,
  simulateThinkingDelay,
} from './lib/responseCache.js'
import { looksLikeUrl, searchProductCandidates } from './lib/tavilySearch.js'

// When true, a cache miss never falls through to Foundry or Tavily — useful
// for demos with no external credentials available at all. A cache hit skips
// them either way, regardless of this flag.
const DEMO_MODE = process.env.DEMO_MODE === 'true'

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const frontendDirectory = path.resolve(serverDirectory, '../dist')
const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/resolve-product', async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 200) : ''
  if (!query) {
    res.status(400).json({ status: 'error', message: 'query is required' })
    return
  }

  // Links skip the cache: short aliases like "af1" would otherwise match random
  // characters inside a product ID in the URL.
  const cached = looksLikeUrl(query) ? null : findCachedAssessment(query)
  if (cached) {
    await simulateThinkingDelay()
    res.json({
      status: 'ok',
      candidates: [{ name: cached.productName, url: null, source: null, image: null }],
    })
    return
  }

  if (DEMO_MODE) {
    await simulateThinkingDelay()
    const available = listCachedProductNames().join(', ')
    res.json({
      status: 'ok',
      candidates: [],
      message: `Demo mode only has data for a few products: ${available}. Try one of those.`,
    })
    return
  }

  try {
    res.json({ status: 'ok', ...(await searchProductCandidates(query)) })
  } catch (error) {
    console.error('Product lookup failed:', error)
    res.status(500).json({ status: 'error', message: 'The product lookup failed' })
  }
})

app.post('/api/chat', async (req, res) => {
  // "assessment" builds the initial scoring JSON; "chat" answers follow-ups in plain text.
  const mode = req.body?.mode === 'chat' ? 'chat' : 'assessment'
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

  // Follow-up questions must never match the cache: "how does the iPhone 15 Pro
  // compare?" would otherwise return the canned assessment instead of an answer.
  const cached = mode === 'assessment' ? getCachedResponse(messages.at(-1).text) : null
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
      reply:
        mode === 'chat'
          ? 'Demo mode only shows the saved assessments. Follow-up questions need the live assistant.'
          : `Demo mode only has data for a few products: ${available}. Try one of those.`,
      assessment: null,
    })
    return
  }

  try {
    const result = await invokeFoundryAgent(messages, { mode })
    res.json({ status: 'ok', ...result })
  } catch (error) {
    console.error('Foundry agent failed:', error)
    res.status(500).json({ status: 'error', message: 'The assistant could not respond' })
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
