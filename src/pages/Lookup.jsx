import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { CoverageBadge, DemoNotice } from '../components/Badges.jsx'
import { EvidenceList, GapItem, SourceLine } from '../components/Evidence.jsx'
import { BackToSearch, LoadError, Loading } from '../components/PageStatus.jsx'
import { useApi } from '../hooks/useApi.js'
import { postJson } from '../lib/api.js'
import { recordVisit } from '../lib/history.js'

const DIMENSION_LABELS = [
  ['planet', 'Planet'],
  ['people', 'People'],
  ['quality', 'Quality'],
  ['value', 'Value'],
  ['transparency', 'Transparency'],
]

const SECTION_HEADING = 'text-2xl font-bold text-slate-900'
// Which lookups this browser has already asked for, so one visitor can't
// keep adding to the count.
const REQUESTED_KEY = 'clearcart_requested'

function readRequested() {
  try {
    return JSON.parse(localStorage.getItem(REQUESTED_KEY) ?? '[]')
  } catch {
    return []
  }
}

function rememberRequested(query) {
  try {
    localStorage.setItem(REQUESTED_KEY, JSON.stringify([...readRequested(), query.toLowerCase()].slice(-200)))
  } catch {
    // Not persisted; the button just won't remember after a reload.
  }
}

function observedSummary(observed) {
  if (observed.source === 'query') return 'From your search'
  const count = observed.listings
  return `From ${count} web ${count === 1 ? 'listing' : 'listings'}`
}

function SectionCard({ section }) {
  const contextOnly = section.kind === 'brandSites'
  return (
    <section
      className={`flex flex-col gap-3 rounded-2xl p-6 ${
        contextOnly ? 'border-2 border-dashed border-slate-400 bg-white' : 'panel'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={SECTION_HEADING}>{section.title}</h2>
        <CoverageBadge coverage={section.coverage} />
      </div>
      <p className="text-base text-slate-700">{section.note}</p>

      {contextOnly ? (
        section.sites.map((site) => (
          <div key={site.name} className="flex flex-col gap-3 rounded-2xl bg-slate-100 p-4">
            <p className="font-bold text-slate-900">
              {site.name}, {site.country}
            </p>
            <p className="text-base text-slate-700">Makes the {site.products.join(' and the ')}.</p>
            <EvidenceList facts={site.facts} gaps={site.gaps} showCoverage={false} />
          </div>
        ))
      ) : section.kind === 'country' ? (
        <ul className="flex flex-col gap-3">
          {section.risks.map((risk) => (
            <li key={risk.id} className="rounded-xl bg-mist-100 px-4 py-3">
              <p className="font-semibold text-slate-900">{risk.statement}</p>
              <SourceLine sources={risk.sources} />
            </li>
          ))}
          {section.gaps.map((gap) => (
            <GapItem key={gap.id} gap={gap} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl bg-mist-100 p-4">
          <EvidenceList facts={section.facts} gaps={section.gaps} showCoverage={false} />
        </div>
      )}
    </section>
  )
}

function RequestCard({ query, initialCount }) {
  const [asked, setAsked] = useState(() => readRequested().includes(query.toLowerCase()))
  const [count, setCount] = useState(initialCount)
  const [status, setStatus] = useState('idle')

  async function ask() {
    setStatus('sending')
    try {
      const result = await postJson('/api/requests', { query })
      rememberRequested(query)
      setAsked(true)
      setCount(result.count)
      setStatus('idle')
    } catch (error) {
      setStatus(error.status === 429 ? 'limited' : 'error')
    }
  }

  const heading =
    count === 0
      ? 'Nobody has asked us to research this yet.'
      : `${count} ${count === 1 ? 'person has' : 'people have'} asked us to research this${asked ? ', including you' : ''}.`

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-accent-800 p-6 text-white">
      <h2 className="text-2xl font-bold">{heading}</h2>
      <p className="leading-7">Products are researched in order of demand.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={ask}
          disabled={asked || status === 'sending'}
          className="rounded-xl bg-white px-5 py-3 text-lg font-bold text-accent-900 transition hover:bg-mist-200 focus-visible:ring-4 focus-visible:ring-white focus-visible:outline-none disabled:cursor-default disabled:bg-mist-200"
        >
          {asked ? 'Added to the research queue' : status === 'sending' ? 'Adding…' : 'Ask for this product'}
        </button>
      </div>
      {status === 'error' && <p aria-live="polite">That didn't go through. Please try again.</p>}
      {status === 'limited' && <p aria-live="polite">You've sent a lot of requests. Please try again later.</p>}
    </section>
  )
}

export default function Lookup() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q')?.trim() ?? ''
  const { data, error, loading } = useApi(query ? `/api/lookup?q=${encodeURIComponent(query)}` : null)

  useEffect(() => {
    if (data?.kind === 'related') recordVisit(data.query, `/lookup?q=${encodeURIComponent(data.query)}`)
  }, [data])

  if (!query) return <Navigate to="/" replace />
  if (loading) return <Loading label="Looking it up…" />
  if (error) return <LoadError message="We couldn't look that up right now. Please try again." />
  if (data.kind === 'product') return <Navigate to={`/product/${data.productId}`} replace state={{ query }} />

  const { observed, sections } = data
  const facts = [
    observed.brand && ['Brand', observed.brand.name],
    observed.materials.length > 0 && [
      'Material',
      observed.materials.map((material) => `${material.percent}% ${material.material}`).join(', '),
    ],
    observed.origin && ['Made in', observed.origin],
  ].filter(Boolean)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
      <BackToSearch query={query} />
      {observed.brand?.demo && <DemoNotice />}

      <header className="panel overflow-hidden">
        <div className="flex flex-col gap-3 bg-linear-to-r from-mist-100 to-white px-6 py-6">
          <span className="self-start rounded-full border-2 border-accent-800 bg-white px-3 py-1 text-sm font-bold text-accent-800">
            Not in our catalogue yet
          </span>
          <h1 className="text-3xl font-bold text-slate-950">{data.query}</h1>
          <p className="text-lg leading-8 text-slate-700">
            {sections.length > 0 ? (
              <>
                We haven't researched this product. Here's what we know from related records. None of it is about
                this product specifically, so <strong className="text-slate-900">nothing on this page is scored</strong>.
              </>
            ) : (
              "We haven't researched this product, and we don't have records about its brand or where it's made yet."
            )}
          </p>
        </div>
        {facts.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold tracking-wide text-accent-800 uppercase">{observedSummary(observed)}</span>
              {/* Listings are retailer/brand claims; the visitor's own words aren't a claim at all. */}
              {observed.source !== 'query' && <CoverageBadge coverage="claimed" />}
            </div>
            <dl className="flex flex-wrap gap-x-10 gap-y-3">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-base text-slate-600">{label}</dt>
                  <dd className="font-bold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {data.note === 'limit' && (
          <p className="border-t border-slate-200 px-6 py-4 text-base text-slate-700">
            Web lookups are paused for now, so this is based on your search words only.
          </p>
        )}
      </header>

      {sections.length > 0 && (
        <section aria-labelledby="coverage-heading" className="flex flex-col gap-3">
          <h2 id="coverage-heading" className="text-2xl font-bold text-accent-800">
            What we can say for each dimension
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {DIMENSION_LABELS.map(([key, label]) => (
              <li key={key} className="flex flex-col items-start gap-2 rounded-2xl bg-slate-100 p-4">
                <span className="font-bold text-slate-900">{label}</span>
                <CoverageBadge coverage={data.dimensions[key]} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {sections.map((section) => (
        <SectionCard key={`${section.kind}-${section.title}`} section={section} />
      ))}

      {data.siblings.length > 0 && (
        <section aria-labelledby="siblings-heading" className="flex flex-col gap-3">
          <h2 id="siblings-heading" className="text-2xl font-bold text-accent-800">
            Researched products from {observed.brand.name}
          </h2>
          <ul className="flex flex-wrap gap-4">
            {data.siblings.map((sibling) => (
              <li key={sibling.id} className="flex-1 basis-60">
                <Link
                  to={`/product/${sibling.id}`}
                  state={{ query }}
                  className="panel block p-4 transition hover:bg-mist-300 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none"
                >
                  <span className="block font-bold text-slate-900">{sibling.name}</span>
                  <span className="block text-base text-slate-600">Full assessment</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RequestCard key={data.query} query={data.query} initialCount={data.requestCount} />
    </div>
  )
}
