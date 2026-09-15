function formatPrice(product) {
  if (!product.price) return null
  const symbol = product.currency === 'USD' || !product.currency ? '$' : `${product.currency} `
  return `${symbol}${product.price}`
}

export default function ProductConfirmCard({ product, status, onConfirm }) {
  const price = formatPrice(product)

  return (
    <div className="max-w-md rounded-2xl border-2 border-teal-500 bg-white p-5 text-gray-900">
      <span className="mb-3 inline-block rounded-full bg-teal-600 px-3 py-1 text-sm font-semibold text-white">
        Found it!
      </span>

      <div className="flex gap-4">
        {product.image && (
          <img
            src={product.image}
            alt=""
            className="h-24 w-24 shrink-0 rounded-lg border border-gray-200 object-contain"
          />
        )}
        <div className="min-w-0">
          <p className="text-lg font-semibold text-gray-900">{product.name}</p>
          {price && <p className="text-gray-700">{price}</p>}
          {product.rating && (
            <p className="text-gray-700">
              ⭐ {product.rating}
              {product.ratingCount ? ` (${product.ratingCount.toLocaleString()})` : ''}
            </p>
          )}
        </div>
      </div>

      {status === 'pending' ? (
        <div className="mt-4">
          <p className="mb-2 text-base font-medium">Is this the right product?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onConfirm(true)}
              className="rounded-full bg-teal-600 px-5 py-2 text-base font-semibold text-white transition hover:bg-teal-700"
            >
              Yes, that's it
            </button>
            <button
              type="button"
              onClick={() => onConfirm(false)}
              className="rounded-full border-2 border-gray-300 px-5 py-2 text-base font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              No, try again
            </button>
          </div>
        </div>
      ) : (
        <p className={`mt-4 text-base font-medium ${status === 'confirmed' ? 'text-teal-700' : 'text-gray-500'}`}>
          {status === 'confirmed' ? 'Confirmed ✓' : "Got it — that wasn't it."}
        </p>
      )}
    </div>
  )
}
