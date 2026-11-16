import { CoverageBadge } from './Badges.jsx'

const TIER_LABELS = {
  regulatory: 'Government record',
  third_party_audit: 'Independent audit',
  investigative: 'Investigation',
  first_hand_report: 'First-hand report',
  self_reported: 'Self-reported',
}

const LINK = 'font-semibold text-accent-800 underline decoration-2 underline-offset-2 hover:text-accent-900'

function formatDate(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// "Independent audit · SA8000 certificate record · reported by @x"
export function SourceLine({ sources, contributor, date }) {
  const tiers = [...new Set(sources.map((source) => TIER_LABELS[source.tier] ?? source.tier))]
  return (
    <p className="mt-1 flex flex-wrap gap-x-2 text-[0.9rem] text-slate-600">
      {tiers.length > 0 && <span>{tiers.join(' and ')}</span>}
      {sources.map((source) => (
        <span key={source.url}>
          ·{' '}
          <a className={LINK} href={source.url} target="_blank" rel="noreferrer">
            {source.title}
          </a>
        </span>
      ))}
      {contributor && <span>· reported by {contributor.handle}</span>}
      {date && <span>· {formatDate(date)}</span>}
    </p>
  )
}

export function FactItem({ fact, showCoverage = true }) {
  return (
    <li className="rounded-xl bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 font-semibold text-slate-900">{fact.statement}</p>
        {showCoverage && <CoverageBadge coverage={fact.coverage} />}
      </div>
      {fact.via && <p className="mt-1 text-[0.9rem] text-slate-600">About {fact.via}</p>}
      <SourceLine sources={fact.sources} contributor={fact.contributor} date={fact.validAsOf} />
    </li>
  )
}

export function GapItem({ gap }) {
  return (
    <li className="rounded-xl border-2 border-dashed border-slate-400 px-4 py-3">
      <p className="font-bold text-slate-800">Not public: {gap.missing.charAt(0).toLowerCase() + gap.missing.slice(1)}.</p>
      <p className="mt-1 text-[0.9rem] text-slate-600">
        {gap.note ??
          `We checked ${gap.whereLooked}${gap.searchedAt ? ` on ${formatDate(gap.searchedAt)}` : ''}.`}
      </p>
    </li>
  )
}

export function EvidenceList({ facts = [], gaps = [], showCoverage = true }) {
  if (facts.length === 0 && gaps.length === 0) {
    return <p className="text-base text-slate-600">No evidence recorded yet.</p>
  }
  return (
    <ul className="flex flex-col gap-3">
      {facts.map((fact) => (
        <FactItem key={fact.id} fact={fact} showCoverage={showCoverage} />
      ))}
      {gaps.map((gap) => (
        <GapItem key={gap.id} gap={gap} />
      ))}
    </ul>
  )
}
