// Builds the "related knowledge" page for a product we haven't researched
// (sandbox/product-entry-example.txt §10). Each section is one rung of the
// ladder and says what it is actually about. Nothing on the page is scored:
// facts reached this way are capped at "inferred", and the brand's other
// factories are context only.

import {
  DIMENSIONS,
  brandAssemblySites,
  getOrganization,
  getSite,
  listProducts,
  orgWideKnowledge,
  ownershipChain,
  riskRowsFor,
  siteWideKnowledge,
  sitesOfOrganization,
} from './catalogue.js'
import { CATEGORY_GOODS } from './webLookup.js'

const RISK_LABELS = { child_labour: 'child labour', forced_labour: 'forced labour' }

function factorySections(observations) {
  const siteIds = new Set(observations.makerSiteIds)
  // A maker named without a site: use its site if it has only one.
  for (const orgId of observations.makerOrgIds) {
    const orgSites = sitesOfOrganization(orgId)
    if (orgSites.length === 1) siteIds.add(orgSites[0])
  }
  return [...siteIds].map((siteId) => {
    const site = getSite(siteId)
    const owner = getOrganization(site.org)
    const siteKnowledge = siteWideKnowledge(siteId, 'inferred')
    const ownerKnowledge = owner ? orgWideKnowledge(owner.id, 'inferred') : { facts: [], gaps: [] }
    return {
      kind: 'factory',
      siteId,
      coverage: 'inferred',
      title: `Reported maker: ${site.name}`,
      note: `A web listing names ${site.name}, ${site.country}, as the maker. This is what we know about it.`,
      facts: [...siteKnowledge.facts, ...ownerKnowledge.facts],
      gaps: [...siteKnowledge.gaps, ...ownerKnowledge.gaps],
    }
  })
}

function ownershipSections(brandId) {
  return ownershipChain(brandId).map((org, index) => {
    const { facts, gaps } = orgWideKnowledge(org.id, 'inferred')
    return index === 0
      ? {
          kind: 'brand',
          coverage: 'inferred',
          title: `About the brand: ${org.name}`,
          note: `Applies to everything ${org.name} sells, not specifically this product.`,
          facts,
          gaps,
        }
      : {
          kind: 'owner',
          coverage: 'inferred',
          title: `Owner: ${org.name}`,
          note: `${org.name} owns ${getOrganization(brandId).name}. Its policies cover the brand, but don't prove what happens at the brand's factories.`,
          facts,
          gaps,
        }
  })
}

// `skipSiteIds`: sites already shown as the reported maker.
function brandSitesSection(brandId, skipSiteIds) {
  const brand = getOrganization(brandId)
  const entries = brandAssemblySites(brandId).filter((entry) => !skipSiteIds.has(entry.siteId))
  if (entries.length === 0) return null
  return {
    kind: 'brandSites',
    coverage: 'context',
    title: `Where ${brand.name} makes its other products`,
    note: "We don't know whether this product is made at the same place.",
    sites: entries.map(({ siteId, products }) => {
      const site = getSite(siteId)
      return { name: site.name, country: site.country, products, ...siteWideKnowledge(siteId, 'inferred') }
    }),
  }
}

function countrySection(observations, riskListLoaded) {
  const goods = CATEGORY_GOODS[observations.category] ?? []
  if (!observations.origin || goods.length === 0) return null
  const risks = riskRowsFor({ goods, country: observations.origin }).map((row) => ({
    id: row.id,
    statement: `${row.good} from ${row.country} are on the ${row.list} for ${RISK_LABELS[row.risk] ?? row.risk}.`,
    sources: row.source ? [row.source] : [],
  }))
  const gaps = observations.materials.some((material) => material.material.includes('cotton'))
    ? [
        {
          id: 'gap_cotton_origin',
          missing: 'Where the cotton was grown',
          note: `“Made in ${observations.origin}” says where it was sewn, not where the cotton came from.`,
        },
      ]
    : []
  return {
    kind: 'country',
    coverage: 'country',
    title: `Country risk: ${goods[0].toLowerCase()} made in ${observations.origin}`,
    note: riskListLoaded
      ? 'A country-wide risk, not a finding about this brand.'
      : "We haven't loaded the government risk lists yet, so we can't check this country.",
    risks,
    gaps,
  }
}

export function buildRelated(observations, { riskListLoaded }) {
  const sections = [...factorySections(observations)]
  const makerSiteIds = new Set(sections.map((section) => section.siteId))
  if (observations.brandId) {
    sections.push(...ownershipSections(observations.brandId))
    const sitesSection = brandSitesSection(observations.brandId, makerSiteIds)
    if (sitesSection) sections.push(sitesSection)
  }
  const country = countrySection(observations, riskListLoaded)
  if (country) sections.push(country)

  // What each dimension can say: only rungs that count (not context-only).
  const counted = sections.filter((section) => section.kind !== 'brandSites')
  const dimensions = Object.fromEntries(
    DIMENSIONS.map((key) => [
      key,
      counted.some((section) => (section.facts ?? []).some((fact) => fact.dimension === key)) ||
      (key === 'people' && counted.some((section) => (section.risks ?? []).length > 0))
        ? 'inferred'
        : 'unknown',
    ]),
  )

  return {
    dimensions,
    sections,
    siblings: observations.brandId ? listProducts({ brandId: observations.brandId }) : [],
  }
}
