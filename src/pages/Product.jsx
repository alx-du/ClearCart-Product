import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CoverageBadge, CoverageKey, DemoNotice, DraftNotice, ScoreDots } from '../components/Badges.jsx'
import { EvidenceList, SourceLine } from '../components/Evidence.jsx'
import MaterialDonut from '../components/MaterialDonut.jsx'
import { BackToSearch, LoadError, Loading } from '../components/PageStatus.jsx'
import { useApi } from '../hooks/useApi.js'
import { recordVisit } from '../lib/history.js'

const DIMENSION_LABELS = {
  planet: 'Planet',
  people: 'People & Supply Chain',
  quality: 'Quality',
  value: 'Value',
  transparency: 'Transparency',
}

const TIER_TITLES = {
  1: 'Final assembly',
  2: 'Materials and components',
  3: 'Processing',
  4: 'Raw material origin',
}

const SECTION_HEADING = 'text-2xl font-bold text-accent-800'

const CONCLUSION_ORIGINS = {
  template: 'Built from the evidence above.',
  generated: 'Written automatically from the evidence above.',
  reviewed: 'Written from the evidence above and checked by the ClearCart team.',
}

function DimensionRow({ dimension, open, onToggle }) {
  const panelId = `evidence-${dimension.key}`
  const count = dimension.facts.length + dimension.gaps.length

  return (
    <li className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl px-2 py-4 text-left transition hover:bg-mist-100 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1 basis-72">
          <span className="block font-bold text-slate-900">{DIMENSION_LABELS[dimension.key]}</span>
          <span className="block text-base text-slate-600">{dimension.summary}</span>
          <span className="sr-only">{open ? 'Hide evidence' : `Show evidence (${count})`}</span>
        </span>
        <span className="flex items-center gap-3">
          <ScoreDots value={dimension.score} />
          <CoverageBadge coverage={dimension.coverage} />
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-accent-800 text-accent-800"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </span>
      </button>
      {open && (
        <div id={panelId} className="mb-4 rounded-2xl bg-mist-100 p-4">
          <EvidenceList facts={dimension.facts} gaps={dimension.gaps} />
        </div>
      )}
    </li>
  )
}

function SupplyChain({ chain }) {
  return (
    <section aria-labelledby="chain-heading" className="panel flex flex-col gap-4 p-6">
      <h2 id="chain-heading" className={SECTION_HEADING}>
        Where it's made
      </h2>
      <ol className="flex flex-col gap-4">
        {chain.map(({ tier, steps, gaps }) => (
          <li key={tier} className="flex gap-4">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${
                steps.length > 0
                  ? 'bg-accent-800 text-white'
                  : 'border-2 border-dashed border-slate-400 text-slate-600'
              }`}
              aria-hidden="true"
            >
              {tier}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-slate-600">
                Tier {tier}: {TIER_TITLES[tier]}
              </p>
              {steps.length === 0 ? (
                <p className="font-bold text-slate-900">
                  {gaps.length > 0 ? `Not known: ${gaps[0].missing.toLowerCase()}` : 'Not known'}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {steps.map((step) => (
                    <li key={`${step.site}-${step.role}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-bold text-slate-900">
                          {step.role} at {step.site}, {step.country}
                        </p>
                        <CoverageBadge coverage={step.coverage} />
                      </div>
                      {step.alsoMakes.length > 0 && (
                        <p className="text-base text-slate-600">Also makes the {step.alsoMakes.join(' and the ')}</p>
                      )}
                      <SourceLine sources={step.sources} contributor={step.contributor} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function Product() {
  const { id } = useParams()
  const location = useLocation()
  const { data, error, loading } = useApi(`/api/catalogue/products/${encodeURIComponent(id)}`)
  // One dimension's evidence open at a time; opening another closes it.
  const [openKey, setOpenKey] = useState(null)
  const product = data?.product

  useEffect(() => {
    if (product) recordVisit(product.name, `/product/${product.id}`)
  }, [product])

  if (loading) return <Loading label="Loading product…" />
  if (error) {
    return <LoadError message={error.status === 404 ? "We don't have that product in our catalogue." : 'This product could not be loaded.'} />
  }

  function toggle(key) {
    setOpenKey((current) => (current === key ? null : key))
  }

  const meta = [
    product.reviewedAt && `Last reviewed ${new Date(`${product.reviewedAt}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    `${product.counts.facts} facts`,
    `${product.counts.sources} sources`,
    product.counts.contributors > 0 && `${product.counts.contributors} contributors`,
  ].filter(Boolean)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
      <BackToSearch query={location.state?.query} />
      {product.demo && <DemoNotice />}
      {product.draft && <DraftNotice note={product.draft} />}

      <header className="panel overflow-hidden">
        <div className="flex flex-col gap-2 bg-linear-to-r from-mist-100 to-white px-6 py-6">
          <span className="self-start rounded-full bg-accent-800 px-3 py-1 text-sm font-bold text-white">
            In our catalogue
          </span>
          <h1 className="text-3xl font-bold text-slate-950">{product.name}</h1>
          {product.brand && (
            <p className="text-lg text-slate-600">
              Made by {product.brand.name}
              {product.owners.length > 0 && ` · owned by ${product.owners.join(', ')}`}
            </p>
          )}
          <p className="text-base text-slate-600">{meta.join(' · ')}</p>
        </div>
        {product.materials.length > 0 && (
          <div className="border-t border-slate-200 px-6 py-5">
            <MaterialDonut materials={product.materials} />
          </div>
        )}
      </header>

      <section aria-labelledby="dimensions-heading" className="panel px-4 py-5 sm:px-6">
        <h2 id="dimensions-heading" className={`${SECTION_HEADING} px-2`}>
          Five dimensions, scored separately
        </h2>
        <div className="mt-4 px-2">
          <CoverageKey />
          <p className="mt-3 text-base text-slate-600">
            Each summary is written from the evidence in its row and updated when that evidence changes. Open a row
            to check it.
          </p>
        </div>
        <ul className="mt-2">
          {product.dimensions.map((dimension) => (
            <DimensionRow
              key={dimension.key}
              dimension={dimension}
              open={openKey === dimension.key}
              onToggle={() => toggle(dimension.key)}
            />
          ))}
        </ul>
      </section>

      <SupplyChain chain={product.chain} />

      {product.contributors.length > 0 && (
        <section aria-labelledby="contributors-heading" className="panel flex flex-col gap-4 p-6">
          <h2 id="contributors-heading" className={SECTION_HEADING}>
            Who reported this
          </h2>
          <ul className="flex flex-wrap gap-4">
            {product.contributors.map((contributor) => (
              <li key={contributor.id} className="flex min-w-60 flex-1 flex-col gap-1 rounded-2xl bg-mist-100 p-4">
                <p className="font-bold text-slate-900">{contributor.handle}</p>
                <p className="text-base text-slate-700">{contributor.about}</p>
                <p className="text-[0.9rem] text-slate-600">
                  {contributor.platform} · {contributor.disclosure}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-accent-800 px-6 py-5 text-white">
        <h2 className="text-xl font-bold">Conclusion</h2>
        <p className="mt-1 leading-7">{product.conclusion.text}</p>
        <p className="mt-3 text-[0.9rem] text-mist-200">{CONCLUSION_ORIGINS[product.conclusion.origin]}</p>
      </section>

      {product.siblings.length > 0 && (
        <section aria-labelledby="siblings-heading" className="flex flex-col gap-3">
          <h2 id="siblings-heading" className={SECTION_HEADING}>
            More from {product.brand.name}
          </h2>
          <ul className="flex flex-wrap gap-4">
            {product.siblings.map((sibling) => (
              <li key={sibling.id} className="flex-1 basis-60">
                <Link
                  to={`/product/${sibling.id}`}
                  className="panel block p-4 font-bold text-slate-900 transition hover:bg-mist-300 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none"
                >
                  {sibling.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
