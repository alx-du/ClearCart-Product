const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search'
const PRODUCT_PAGE_PATTERN = /amazon\.[a-z.]+\/.*(\/dp\/|\/gp\/product\/)/i

export async function searchAmazonProductUrls(query, { count = 5 } = {}) {
  const apiKey = process.env.BRAVE_API_KEY
  if (!apiKey) {
    throw new Error('BRAVE_API_KEY is not set')
  }

  const url = new URL(BRAVE_ENDPOINT)
  url.searchParams.set('q', `${query} site:amazon.com`)
  url.searchParams.set('count', String(count))

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
  })

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status}`)
  }

  const data = await response.json()
  const results = data.web?.results ?? []

  return [...new Set(results.map((result) => result.url).filter((resultUrl) => PRODUCT_PAGE_PATTERN.test(resultUrl)))]
}
