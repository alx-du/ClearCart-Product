import { Link } from 'react-router-dom'

export function Loading({ label }) {
  return (
    <p className="py-16 text-center text-xl text-slate-600" aria-live="polite">
      {label}
    </p>
  )
}

export function LoadError({ message }) {
  return (
    <div className="panel mx-auto mt-10 max-w-xl px-6 py-6 text-center">
      <p className="text-xl font-semibold text-slate-900">{message}</p>
      <Link
        to="/"
        className="mt-4 inline-block rounded-xl border-2 border-accent-800 px-5 py-2.5 font-bold text-accent-800 transition hover:bg-mist-300 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none"
      >
        Back to search
      </Link>
    </div>
  )
}

const BACK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
    <path d="M19 12H5" />
    <path d="M11 6l-6 6 6 6" />
  </svg>
)

// Back to the search results the visitor came from, if any.
export function BackToSearch({ query }) {
  return (
    <Link
      to={query ? `/?q=${encodeURIComponent(query)}` : '/'}
      className="inline-flex items-center gap-2 self-start rounded-lg px-1 py-2 font-bold text-accent-800 hover:text-accent-900 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none"
    >
      {BACK_ICON}
      Back to search
    </Link>
  )
}
