import { app } from '@azure/functions'
import { invokeFoundryAgent } from '../lib/foundryAgent.js'

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

    try {
      const reply = await invokeFoundryAgent(messages)
      return { jsonBody: { status: 'ok', reply } }
    } catch (error) {
      context.error('Foundry agent failed:', error)
      return {
        status: 500,
        jsonBody: { status: 'error', message: 'The assistant could not respond' },
      }
    }
  },
})
