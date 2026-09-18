import { useState } from 'react'

// Photos are hotlinked from retailers, so hide the slot if one fails to load
// rather than showing a broken-image icon.
function ProductImage({ src }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-24 w-24 shrink-0 rounded-lg border border-slate-200 bg-white object-contain"
    />
  )
}

export default function ProductConfirmCard({
  candidate,
  position,
  status,
  canShowMore,
  canGoBack,
  onBack,
  onDecision,
}) {
  return (
    <div className="panel max-w-md border-2 border-mist-300 p-5 text-slate-900">
      <span className="mb-3 inline-block rounded-full bg-accent-800 px-3 py-1 text-sm font-semibold text-white">
        Found it!
      </span>

      <div className="flex gap-4">
        {candidate.image && <ProductImage key={candidate.image} src={candidate.image} />}
        <div className="min-w-0">
          <p className="text-lg font-semibold break-words text-slate-900">{candidate.name}</p>
          {candidate.source && (
            <p className="text-slate-700">
              from{' '}
              <a
                href={candidate.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-accent-800 underline decoration-2 underline-offset-2 hover:text-accent-900"
              >
                {candidate.source}
              </a>
            </p>
          )}
        </div>
      </div>

      {status === 'pending' ? (
        <div className="mt-4">
          <p className="mb-2 text-base font-medium">Is this the right product?</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onDecision(true)}
              className="rounded-full bg-accent-800 px-5 py-2 text-base font-semibold text-white transition hover:bg-accent-900 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none"
            >
              Yes, that's it
            </button>
            <button
              type="button"
              onClick={() => onDecision(false)}
              className="rounded-full border-2 border-accent-800 px-5 py-2 text-base font-semibold text-accent-800 transition hover:bg-mist-300 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none"
            >
              {canShowMore ? 'No, show another' : "No, that's not it"}
            </button>
          </div>
          {(canGoBack || position) && (
            <div className="mt-3 flex items-center gap-3">
              {canGoBack && (
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="Back to the previous result"
                  className="rounded-full px-4 py-2 text-base font-semibold text-accent-800 transition hover:bg-mist-300 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none"
                >
                  ← Back
                </button>
              )}
              {position && <p className="text-sm text-slate-600">{position}</p>}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-base font-medium text-accent-800">Added to your cart ✓</p>
      )}
    </div>
  )
}
