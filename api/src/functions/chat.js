import { app } from '@azure/functions'
import { invokeFoundryAgent } from '../lib/foundryAgent.js'
import {
  getCachedResponse,
  listCachedProductNames,
  simulateThinkingDelay,
} from '../lib/responseCache.js'

// When true, a cache miss never falls through to Foundry — useful for demos
// with no Azure credentials available at all. A cache hit skips Foundry
// either way, regardless of this flag.
const DEMO_MODE = process.env.DEMO_MODE === 'true'

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

    // "assessment" builds the initial scoring JSON; "chat" answers follow-ups in plain text.
    const mode = body?.mode === 'chat' ? 'chat' : 'assessment'
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

    // Follow-up questions must never match the cache: "how does the iPhone 15 Pro
    // compare?" would otherwise return the canned assessment instead of an answer.
    const cached = mode === 'assessment' ? getCachedResponse(messages.at(-1).text) : null
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
          reply:
            mode === 'chat'
              ? 'Demo mode only shows the saved assessments. Follow-up questions need the live assistant.'
              : `Demo mode only has data for a few products: ${available}. Try one of those.`,
          assessment: null,
        },
      }
    }

    try {
      const result = await invokeFoundryAgent(messages, { mode })
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
