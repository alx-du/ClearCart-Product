// A cache of pre-computed assessments — the same shape invokeFoundryAgent
// returns, keyed by product. Checked before ever calling Foundry: a cache
// hit needs no Azure credentials and costs nothing. Entries are hand-seeded
// for now; the real version of this (BACKLOG.md A5) would also populate
// itself from live Foundry responses, but the lookup/consumption shape is
// the same either way.
// Mirrored at api/src/lib/responseCache.js for the production Functions app.

function dimension(score, coverage, explanation) {
  return { score, coverage, explanation, sources: [] }
}

const CACHED_ASSESSMENTS = [
  {
    aliases: ['iphone 15 pro', 'iphone15pro', 'apple iphone 15 pro'],
    productName: 'iPhone 15 Pro',
    brand: 'Apple',
    dimensions: {
      planet: dimension(
        2,
        'inferred',
        'Apple publishes a per-product environmental report, but independent verification of the recycled-material claims is limited.',
      ),
      people: dimension(
        null,
        'unknown',
        'Apple discloses its final assembly suppliers, but component-level labor conditions for this specific model are not independently disclosed.',
      ),
      quality: dimension(
        4,
        'scored',
        'Widely reviewed build quality and multi-year software support consistent with the premium tier.',
      ),
      value: dimension(
        2,
        'inferred',
        'A significant share of the price reflects brand positioning rather than a proportional increase in manufacturing cost over mid-tier phones.',
      ),
      transparency: dimension(
        3,
        'claimed',
        'Apple publishes a supplier list and a product environmental report, though the underlying audit data is not made public.',
      ),
    },
    conclusion:
      'Strong on quality, with real but self-reported transparency. The two rights-related dimensions remain the least evidenced — that gap is the finding, not a failure of the lookup.',
  },
  {
    aliases: ['nike air force 1', 'air force 1', 'af1'],
    productName: 'Nike Air Force 1',
    brand: 'Nike',
    dimensions: {
      planet: dimension(
        null,
        'unknown',
        'No independent lifecycle or emissions data was found for this specific model.',
      ),
      people: dimension(
        null,
        'unknown',
        'Nike publishes a global supplier list, but this product line is not traceable to a specific factory from public sources.',
      ),
      quality: dimension(
        4,
        'scored',
        'Consistently rated as durable across long-running consumer reviews spanning decades of the same design.',
      ),
      value: dimension(
        3,
        'inferred',
        'Mid-range pricing for the category; a moderate share goes to marketing given the line’s cultural profile rather than materials.',
      ),
      transparency: dimension(
        2,
        'claimed',
        'Nike publishes a supplier list at the company level, but does not disclose which factory produced a given pair.',
      ),
    },
    conclusion:
      'A durable, well-understood product on quality, but Planet and People remain Unknown — Nike has not published the evidence needed to score them.',
  },
  {
    aliases: ['patagonia better sweater', 'better sweater', 'patagonia fleece'],
    productName: 'Patagonia Better Sweater Fleece',
    brand: 'Patagonia',
    dimensions: {
      planet: dimension(
        4,
        'scored',
        'Made with recycled polyester and certified under an independent recycled-content standard, with third-party verification available.',
      ),
      people: dimension(
        3,
        'inferred',
        'Patagonia publishes factory names and Fair Labor Association affiliation, though independent audit results are not fully public.',
      ),
      quality: dimension(
        4,
        'scored',
        'Long-running product line with strong durability track record and a repair program that extends usable life.',
      ),
      value: dimension(
        3,
        'inferred',
        'Priced at a premium versus fast-fashion fleece, roughly proportional to certified materials and stated factory standards.',
      ),
      transparency: dimension(
        4,
        'scored',
        'Publishes its factory list and environmental impact per product, above the norm for the apparel category.',
      ),
    },
    conclusion:
      'One of the more fully evidenced products in this demo set across all five dimensions, driven by the brand’s own disclosure practices.',
  },
]

function normalize(text) {
  return text.trim().toLowerCase()
}

export function findCachedAssessment(query) {
  const normalized = normalize(query)
  if (!normalized) return null

  return (
    CACHED_ASSESSMENTS.find((entry) => entry.aliases.some((alias) => normalized.includes(alias))) ??
    null
  )
}

export function listCachedProductNames() {
  return CACHED_ASSESSMENTS.map((entry) => entry.productName)
}

// A cache hit is near-instant, which reads as obviously fake next to a real
// round trip — hold it briefly so cached and live responses feel consistent.
export function simulateThinkingDelay() {
  const delayMs = 900 + Math.random() * 1200
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

// Same return shape as invokeFoundryAgent: { reply, assessment }.
// Returns null on a cache miss — callers decide what to do next (fall
// through to Foundry, or refuse to in a credential-free demo context).
export function getCachedResponse(latestUserText) {
  const match = findCachedAssessment(latestUserText ?? '')
  if (!match) return null

  const { aliases: _aliases, ...assessment } = match
  return { reply: assessment.conclusion, assessment }
}
