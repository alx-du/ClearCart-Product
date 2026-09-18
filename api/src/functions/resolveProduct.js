import { app } from '@azure/functions'
import {
  findCachedAssessment,
  listCachedProductNames,
  simulateThinkingDelay,
} from '../lib/responseCache.js'
import { looksLikeUrl, searchProductCandidates } from '../lib/tavilySearch.js'

// When true, a cache miss never falls through to Tavily — useful for demos
// with no external credentials available at all. A cache hit skips it
// either way, regardless of this flag.
const DEMO_MODE = process.env.DEMO_MODE === 'true'

app.http('resolveProduct', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'resolve-product',
  handler: async (request, context) => {
    let body
    try {
      body = await request.json()
    } catch {
      return { status: 400, jsonBody: { status: 'error', message: 'Valid JSON is required' } }
    }

    const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 200) : ''
    if (!query) {
      return { status: 400, jsonBody: { status: 'error', message: 'query is required' } }
    }

    // Links skip the cache: short aliases like "af1" would otherwise match random
    // characters inside a product ID in the URL.
    const cached = looksLikeUrl(query) ? null : findCachedAssessment(query)
    if (cached) {
      await simulateThinkingDelay()
      return {
        jsonBody: {
          status: 'ok',
          candidates: [{ name: cached.productName, url: null, source: null, image: null }],
        },
      }
    }

    if (DEMO_MODE) {
      await simulateThinkingDelay()
      const available = listCachedProductNames().join(', ')
      return {
        jsonBody: {
          status: 'ok',
          candidates: [],
          message: `Demo mode only has data for a few products: ${available}. Try one of those.`,
        },
      }
    }

    try {
      return { jsonBody: { status: 'ok', ...(await searchProductCandidates(query)) } }
    } catch (error) {
      context.error('Product lookup failed:', error)
      return {
        status: 500,
        jsonBody: { status: 'error', message: 'The product lookup failed' },
      }
    }
  },
})
