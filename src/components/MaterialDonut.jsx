import { useState } from 'react'

// Slots in fixed order (validated together, see index.css). Past three
// materials the rest fold into a neutral "Other" rather than a new hue. Full
// class names, so Tailwind generates the colors.
const SLOT_COLORS = [
  { stroke: 'stroke-accent-600', swatch: 'bg-accent-600' },
  { stroke: 'stroke-chart-2', swatch: 'bg-chart-2' },
  { stroke: 'stroke-chart-3', swatch: 'bg-chart-3' },
]
const OTHER_COLOR = { stroke: 'stroke-slate-500', swatch: 'bg-slate-500' }
const NOT_STATED_COLOR = { stroke: 'stroke-slate-200', swatch: 'bg-slate-200' }

const SIZE = 132
const STROKE = 18
const HOVER_GROWTH = 4
// Leaves room for a hovered segment's thicker stroke.
const RADIUS = (SIZE - STROKE - HOVER_GROWTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
// Surface-coloured gap between neighbouring segments, in px along the ring.
const GAP = 2

function toSegments(materials) {
  const known = materials
    .filter((material) => Number.isFinite(material.percent) && material.percent > 0)
    .sort((a, b) => b.percent - a.percent)
  const shown = known.slice(0, SLOT_COLORS.length).map((material, index) => ({
    key: material.material,
    label: material.material,
    percent: material.percent,
    note: material.recycledPercent > 0 ? `${material.recycledPercent}% recycled` : null,
    color: SLOT_COLORS[index],
  }))
  const rest = known.slice(SLOT_COLORS.length)
  if (rest.length > 0) {
    shown.push({
      key: 'other',
      label: 'other',
      percent: rest.reduce((sum, material) => sum + material.percent, 0),
      note: rest.map((material) => material.material).join(', '),
      color: OTHER_COLOR,
    })
  }
  const total = shown.reduce((sum, segment) => sum + segment.percent, 0)
  if (total < 100) {
    shown.push({ key: 'not-stated', label: 'not stated', percent: 100 - total, note: null, color: NOT_STATED_COLOR })
  }
  return shown
}

function describe(segment) {
  return `${segment.percent}% ${segment.label}${segment.note ? ` (${segment.note})` : ''}`
}

// What the product is made of, as a ring with the main material in the middle
// and every value also written out in the list beside it.
export default function MaterialDonut({ materials }) {
  const [active, setActive] = useState(null)
  const segments = toSegments(materials)
  if (segments.length === 0) return null

  const primary = segments[0]
  const gap = segments.length > 1 ? GAP : 0
  const lengths = segments.map((segment) => (segment.percent / 100) * CIRCUMFERENCE)
  const arcs = segments.map((segment, index) => ({
    ...segment,
    dash: Math.max(lengths[index] - gap, 0.5),
    // Each segment starts where the ones before it end.
    offset: lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  }))

  const highlight = (key) => () => setActive(key)
  const clear = () => setActive(null)

  return (
    <figure className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-32 w-32 shrink-0"
        role="img"
        aria-label={`Materials: ${segments.map(describe).join(', ')}`}
      >
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={active === arc.key ? STROKE + HOVER_GROWTH : STROKE}
              strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
              strokeDashoffset={-arc.offset}
              opacity={active && active !== arc.key ? 0.35 : 1}
              onMouseEnter={highlight(arc.key)}
              onMouseLeave={clear}
              className={`${arc.color.stroke} transition-[opacity,stroke-width] duration-150`}
            >
              <title>{describe(arc)}</title>
            </circle>
          ))}
        </g>
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          className="fill-slate-900 text-[26px] font-bold"
        >
          {primary.percent}%
        </text>
        <text x="50%" y="64%" textAnchor="middle" className="fill-slate-600 text-[15px]">
          {primary.label}
        </text>
      </svg>

      <figcaption className="min-w-0">
        <span className="mb-1 block text-sm font-bold tracking-wide text-accent-800 uppercase">Made of</span>
        <ul className="flex flex-col gap-1">
          {segments.map((segment) => (
            <li
              key={segment.key}
              onMouseEnter={highlight(segment.key)}
              onMouseLeave={clear}
              className={`flex items-center gap-2 text-base text-slate-800 transition-opacity ${
                active && active !== segment.key ? 'opacity-50' : ''
              }`}
            >
              <span className={`h-3 w-3 shrink-0 rounded-full ${segment.color.swatch}`} aria-hidden="true" />
              <span>
                <strong className="font-semibold">{segment.percent}%</strong> {segment.label}
                {segment.note && <span className="text-slate-600"> ({segment.note})</span>}
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
