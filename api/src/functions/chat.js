import { app } from '@azure/functions'
import { invokeFoundryAgent } from '../lib/foundryAgent.js'
import { getCachedResponse, listCachedProductNames } from '../lib/responseCache.js'

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

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'chat',
  handler: async (request, context) => {
    let body
    try {
      body = await request.json()
    } catch {
      return { status: 400, jsonBody: { status: 'error', message: 'Valid JSON is required' } }
    }

    const messages = Array.isArray(body?.messages)
      ? body.messages
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
      return { status: 400, jsonBody: { status: 'error', message: 'A user message is required' } }
    }

    const cached = getCachedResponse(messages.at(-1).text)
    if (cached) {
      await simulateThinkingDelay()
      return { jsonBody: { status: 'ok', ...cached } }
    }

    if (DEMO_MODE) {
      await simulateThinkingDelay()
      const available = listCachedProductNames().join(', ')
      return {
        jsonBody: {
          status: 'ok',
          reply: `Demo mode only has data for a few products: ${available}. Try one of those.`,
          assessment: null,
        },
      }
    }

    try {
      const result = await invokeFoundryAgent(messages)
      return { jsonBody: { status: 'ok', ...result } }
    } catch (error) {
      context.error('Foundry agent failed:', error)
      return {
        status: 500,
        jsonBody: { status: 'error', message: 'The assistant could not respond' },
      }
    }
  },
})
