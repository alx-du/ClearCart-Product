import cors from 'cors'
import 'dotenv/config'
import express from 'express'
import { searchAmazonProductUrls } from './lib/braveSearch.js'
import { findProduct } from './lib/productLookup.js'

const app = express()
app.use(cors())
app.use(express.json())

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

const PORT = process.env.PORT || 8787
app.listen(PORT, () => {
  console.log(`ClearCart API listening on http://localhost:${PORT}`)
})
