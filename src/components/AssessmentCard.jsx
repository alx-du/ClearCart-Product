import { useState } from 'react'

const DIMENSIONS = [
  ['planet', 'Planet'],
  ['people', 'People & Supply Chain'],
  ['quality', 'Quality'],
  ['value', 'Value'],
  ['transparency', 'Transparency'],
]

const COVERAGE_STYLES = {
  scored: 'bg-teal-100 text-teal-800',
  inferred: 'bg-amber-100 text-amber-900',
  claimed: 'bg-blue-100 text-blue-800',
  unknown: 'bg-slate-200 text-slate-700',
}

function Score({ value }) {
  if (!Number.isInteger(value)) return <span className="font-semibold text-slate-600">Unknown</span>

  return (
    <span className="flex items-center gap-2" aria-label={`${value} out of 5`}>
      <span className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            className={`h-3 w-3 rounded-full ${step <= value ? 'bg-teal-600' : 'bg-slate-200'}`}
          />
        ))}
      </span>
      <span className="text-sm font-semibold text-slate-700">{value}/5</span>
    </span>
  )
}

export default function AssessmentCard({ assessment }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <article className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 to-white px-5 py-5 sm:px-6">
        <span className="mb-2 inline-block rounded-full bg-teal-700 px-3 py-1 text-sm font-semibold text-white">
          ClearCart assessment
        </span>
        <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">{assessment.productName}</h2>
        {assessment.brand && <p className="mt-1 text-base text-slate-600">Made by {assessment.brand}</p>}
      </div>

      <div className="px-5 py-5 sm:px-6">
        <dl className="space-y-4">
          {DIMENSIONS.map(([key, label]) => {
            const dimension = assessment.dimensions[key]
            return (
              <div key={key} className="flex flex-col gap-2 border-b border-slate-100 pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <dt className="font-semibold text-slate-900">{label}</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <Score value={dimension.score} />
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${COVERAGE_STYLES[dimension.coverage]}`}>
                    {dimension.coverage}
                  </span>
                </dd>
              </div>
            )
          })}
        </dl>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-5 w-full rounded-xl border-2 border-teal-700 px-4 py-3 text-base font-bold text-teal-800 transition hover:bg-teal-50 focus-visible:ring-4 focus-visible:ring-teal-100 focus-visible:outline-none"
        >
          {expanded ? 'Hide sources & explanations' : 'Expand sources & explanations'}
        </button>

        {expanded && (
          <div className="mt-5 space-y-5 rounded-xl bg-slate-50 p-4 sm:p-5">
            {DIMENSIONS.map(([key, label]) => {
              const dimension = assessment.dimensions[key]
              return (
                <section key={key}>
                  <h3 className="font-bold text-slate-900">{label}</h3>
                  <p className="mt-1 leading-7 text-slate-700">{dimension.explanation}</p>
                  {dimension.sources.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {dimension.sources.map((source) => (
                        <li key={source.url}>
                          <a className="font-semibold text-teal-800 underline decoration-2 underline-offset-2 hover:text-teal-950" href={source.url} target="_blank" rel="noreferrer">
                            {source.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm font-medium text-slate-500">No source was provided for this dimension.</p>
                  )}
                </section>
              )
            })}
            <p className="border-t border-slate-200 pt-4 text-sm leading-6 text-slate-500">
              This is a preliminary AI assessment. Review the evidence before making a purchasing decision.
            </p>
          </div>
        )}

        <div className="mt-5 rounded-xl bg-teal-950 px-4 py-4 text-white sm:px-5">
          <h3 className="font-bold">Conclusion</h3>
          <p className="mt-1 leading-7 text-teal-50">{assessment.conclusion}</p>
        </div>
      </div>
    </article>
  )
}
