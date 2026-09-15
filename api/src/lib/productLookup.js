import * as cheerio from 'cheerio'

const FETCH_TIMEOUT_MS = 8000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function extractImage(value) {
  const first = firstValue(value)
  if (!first) return null
  if (typeof first === 'string') return first
  if (typeof first === 'object') return first.url ?? null
  return null
}

function extractOffer(offers) {
  const offer = firstValue(offers)
  if (!offer || typeof offer !== 'object') return { price: null, currency: null }
  return {
    price: offer.price ?? offer.lowPrice ?? null,
    currency: offer.priceCurrency ?? null,
  }
}

function flattenJsonLdNodes(parsed) {
  if (Array.isArray(parsed)) return parsed.flatMap(flattenJsonLdNodes)
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed['@graph'])) return parsed['@graph'].flatMap(flattenJsonLdNodes)
    return [parsed]
  }
  return []
}

function isProductNode(node) {
  const type = node['@type']
  return Array.isArray(type) ? type.includes('Product') : type === 'Product'
}

export function parseProductFromHtml(html, pageUrl) {
  const $ = cheerio.load(html)
  const nodes = []

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      nodes.push(...flattenJsonLdNodes(JSON.parse($(el).contents().text())))
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  })

  const product = nodes.find(isProductNode)
  if (!product?.name) return null

  const { price, currency } = extractOffer(product.offers)
  const rating = product.aggregateRating ?? {}

  return {
    name: product.name,
    image: extractImage(product.image),
    price,
    currency,
    rating: rating.ratingValue ?? null,
    ratingCount: rating.reviewCount ?? rating.ratingCount ?? null,
    url: pageUrl,
  }
}

async function fetchProductPage(pageUrl) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    return response.ok ? await response.text() : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function findProduct(candidateUrls) {
  for (const url of candidateUrls) {
    const html = await fetchProductPage(url)
    if (!html) continue
    const product = parseProductFromHtml(html, url)
    if (product) return product
  }
  return null
}
