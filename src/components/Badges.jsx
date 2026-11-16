// Coverage states (BACKLOG) plus the two related-page kinds: "context" for the
// brand's other factories and "country" for country-wide risk lists.
const COVERAGE = {
  scored: ['Scored', 'bg-mist-200 text-accent-900'],
  inferred: ['Inferred', 'bg-amber-100 text-amber-900'],
  claimed: ['Claimed', 'bg-blue-100 text-blue-800'],
  unknown: ['Unknown', 'bg-slate-200 text-slate-700'],
  context: ['Context only', 'bg-white text-slate-700 ring-2 ring-slate-500 ring-inset'],
  country: ['Country level', 'bg-purple-100 text-purple-800'],
}

export function CoverageBadge({ coverage }) {
  const [label, style] = COVERAGE[coverage] ?? COVERAGE.unknown
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide uppercase ${style}`}>
      {label}
    </span>
  )
}

// What each coverage badge means, in plain words. Shown above the dimensions so
// a badge is never left for the reader to decode.
const COVERAGE_MEANINGS = [
  ['scored', 'Backed by independent evidence about this product.'],
  ['inferred', 'A reasonable estimate from related or weaker evidence. Not proven for this product.'],
  ['claimed', 'Only the brand or seller says so. No score.'],
  ['unknown', 'Nothing found yet. No score.'],
]

export function CoverageKey() {
  return (
    <dl className="grid gap-x-6 gap-y-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
      {COVERAGE_MEANINGS.map(([coverage, meaning]) => (
        <div key={coverage} className="flex items-start gap-3">
          <dt className="w-24 shrink-0">
            <CoverageBadge coverage={coverage} />
          </dt>
          <dd className="text-base text-slate-700">{meaning}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ScoreDots({ value }) {
  if (!Number.isInteger(value)) return <span className="font-semibold text-slate-600">No score</span>

  return (
    <span className="flex items-center gap-2" aria-label={`${value} out of 5`}>
      <span className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            className={`h-3 w-3 rounded-full ${step <= value ? 'bg-accent-700' : 'bg-mist-200'}`}
          />
        ))}
      </span>
      <span className="text-sm font-semibold text-slate-700">{value}/5</span>
    </span>
  )
}

export function DemoNotice() {
  return (
    <p className="rounded-xl bg-amber-100 px-4 py-3 text-base text-amber-900">
      <strong>Demo data.</strong> This brand, its owner and its suppliers are made up to show how ClearCart
      works. Links to example.com are placeholders.
    </p>
  )
}
