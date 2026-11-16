import { Link, useSearchParams } from 'react-router-dom'
import { DemoNotice } from '../components/Badges.jsx'
import { LoadError, Loading } from '../components/PageStatus.jsx'
import { useApi } from '../hooks/useApi.js'

export default function Catalogue() {
  const [searchParams] = useSearchParams()
  const brandId = searchParams.get('brand')
  const { data, error, loading } = useApi(
    brandId ? `/api/catalogue/products?brand=${encodeURIComponent(brandId)}` : '/api/catalogue/products',
  )

  if (loading) return <Loading label="Loading the catalogue…" />
  if (error) return <LoadError message={error.status === 404 ? "We don't know that brand yet." : 'The catalogue could not be loaded.'} />

  const { brand, products } = data
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-accent-800">{brand ? `Products from ${brand.name}` : 'Browse the catalogue'}</h1>
        <p className="text-lg text-slate-600">
          {brand ? (
            <>
              Everything we've researched from {brand.name}.{' '}
              <Link to="/catalogue" className="font-semibold text-accent-800 underline decoration-2 underline-offset-2">
                See the whole catalogue
              </Link>
            </>
          ) : (
            'Every product we have researched, with sources for each claim.'
          )}
        </p>
      </div>
      {brand?.demo && <DemoNotice />}

      {products.length === 0 ? (
        <p className="text-lg text-slate-700">Nothing here yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {products.map((product) => (
            <li key={product.id}>
              <Link
                to={`/product/${product.id}`}
                className="panel flex items-center gap-4 p-4 transition hover:bg-mist-300 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none"
              >
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-mist-200 text-xl font-bold text-accent-900"
                  aria-hidden="true"
                >
                  {product.name.charAt(0)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-lg font-bold text-slate-900">{product.name}</span>
                  <span className="text-base text-slate-600">{product.brand}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
