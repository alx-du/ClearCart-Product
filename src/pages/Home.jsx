import { Link, useSearchParams } from 'react-router-dom'
import { Loading } from '../components/PageStatus.jsx'
import SearchInput from '../components/SearchInput.jsx'
import { useApi } from '../hooks/useApi.js'

const ROW =
  'flex items-center gap-4 rounded-xl p-3 text-slate-800 transition hover:bg-mist-300 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none'
const GROUP_HEADING = 'px-6 pt-5 pb-2 text-sm font-bold tracking-wide text-accent-800 uppercase'

function ProductRow({ product, query }) {
  return (
    <li>
      <Link to={`/product/${product.id}`} state={{ query }} className={ROW}>
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-mist-200 text-xl font-bold text-accent-900"
          aria-hidden="true"
        >
          {product.name.charAt(0)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg font-bold text-slate-900">{product.name}</span>
          <span className="text-base text-slate-600">{product.brand}</span>
        </span>
        <span className="hidden shrink-0 rounded-full bg-accent-800 px-3 py-1 text-sm font-bold text-white sm:inline">
          {product.exact ? 'Exact match' : 'Full assessment'}
        </span>
      </Link>
    </li>
  )
}

function Results({ query }) {
  const { data, error, loading } = useApi(`/api/catalogue/search?q=${encodeURIComponent(query)}`)
  if (loading) return <Loading label="Searching our catalogue…" />
  if (error) {
    return <p className="text-center text-lg text-slate-700">Our catalogue isn't reachable right now. Please try again.</p>
  }

  const { products, brands } = data
  const hasExact = products.some((product) => product.exact)
  const lookupLink = `/lookup?q=${encodeURIComponent(query)}`

  return (
    <section aria-label="Search results" className="panel mx-auto w-full max-w-3xl overflow-hidden">
      {products.length > 0 && (
        <>
          <h2 className={GROUP_HEADING}>In our catalogue</h2>
          <ul className="flex flex-col gap-1 px-3 pb-3">
            {products.map((product) => (
              <ProductRow key={product.id} product={product} query={query} />
            ))}
          </ul>
        </>
      )}

      {brands.length > 0 && (
        <div className={products.length > 0 ? 'border-t border-slate-200' : ''}>
          <h2 className={GROUP_HEADING}>Brands we know</h2>
          <ul className="px-3 pb-3">
            {brands.map((brand) => (
              <li key={brand.id}>
                <Link to={`/catalogue?brand=${brand.id}`} className={ROW}>
                  <span
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-mist-200 bg-mist-100 text-xl font-bold text-accent-800"
                    aria-hidden="true"
                  >
                    {brand.name.charAt(0)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-lg font-bold text-slate-900">{brand.name}</span>
                    <span className="text-base text-slate-600">
                      {brand.productCount} researched {brand.productCount === 1 ? 'product' : 'products'}
                      {brand.parent ? ` · owned by ${brand.parent}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasExact && (
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-mist-100 px-6 py-5">
          <p className="text-base text-slate-700">
            {products.length > 0 || brands.length > 0
              ? 'Not the product you meant?'
              : "We haven't researched anything matching that yet."}
          </p>
          <Link
            to={lookupLink}
            className="flex items-center justify-between gap-4 rounded-2xl border-2 border-accent-800 bg-white px-5 py-4 text-lg font-bold text-accent-800 transition hover:bg-mist-300 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none"
          >
            <span>Look up “{query}” on the web</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 shrink-0" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </Link>
          <p className="text-base text-slate-600">
            Takes a few seconds. If we haven't researched it, we'll show what we know about its brand and where
            it's made.
          </p>
        </div>
      )}
    </section>
  )
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q')?.trim() ?? ''

  function handleSearch(text) {
    setSearchParams({ q: text })
  }

  if (!query) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pt-10 pb-24">
        <h1 className="flex items-center gap-3 text-4xl font-bold text-accent-800">
          ClearCart
          <span aria-hidden="true">🛒</span>
        </h1>
        <p className="text-xl text-slate-600">Let's look at a product together.</p>
        <div className="mt-4 w-full px-4">
          <SearchInput size="large" onSearch={handleSearch} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-10 sm:px-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold text-accent-800">ClearCart</h1>
        <p className="text-lg text-slate-600">Let's look at a product together.</p>
      </div>
      {/* Keyed by query so the box shows the current search after back/forward. */}
      <SearchInput key={query} initialValue={query} onSearch={handleSearch} />
      <Results query={query} />
    </div>
  )
}
