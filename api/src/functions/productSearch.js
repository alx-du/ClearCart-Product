import { app } from '@azure/functions'
import { searchAmazonProductUrls } from '../lib/braveSearch.js'
import { findProduct } from '../lib/productLookup.js'

app.http('product-search', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'products/search',
  handler: async (request, context) => {
    let body
    try {
      body = await request.json()
    } catch {
      return { status: 400, jsonBody: { status: 'error', message: 'Valid JSON is required' } }
    }

    const query = typeof body?.query === 'string' ? body.query.trim() : ''
    if (!query) {
      return { status: 400, jsonBody: { status: 'error', message: 'query is required' } }
    }

    try {
      const candidateUrls = await searchAmazonProductUrls(query)
      const product = candidateUrls.length > 0 ? await findProduct(candidateUrls) : null
      return { jsonBody: product ? { status: 'found', product } : { status: 'not_found' } }
    } catch (error) {
      context.error('Product search failed:', error)
      return { status: 500, jsonBody: { status: 'error', message: 'Product search failed' } }
    }
  },
})
