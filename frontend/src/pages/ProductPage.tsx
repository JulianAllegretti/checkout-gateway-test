import { useDispatch } from 'react-redux'
import { useGetCurrentProductQuery } from '../features/checkout/api'
import { productSelected } from '../features/checkout/checkoutSlice'
import { formatMoney } from '../lib/format'

export function ProductPage() {
  const dispatch = useDispatch()
  // Reached both on first load and after a checkout resets back to it
  // (screen 5) — always refetch so stock reflects the purchase that just
  // happened instead of serving RTK Query's cached response.
  const {
    data: product,
    isLoading,
    isError,
  } = useGetCurrentProductQuery(undefined, { refetchOnMountOrArgChange: true })

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <p className="text-gray-500">Loading...</p>
      </main>
    )
  }

  if (isError || !product) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <p className="text-gray-500">
          Something went wrong loading the product.
        </p>
      </main>
    )
  }

  const outOfStock = product.stock === 0

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-4 p-6">
      <img
        src={product.imageUrl}
        alt={product.name}
        className="aspect-square w-full rounded-lg bg-gray-100 object-cover"
      />
      <h1 className="text-xl font-semibold text-gray-900">{product.name}</h1>
      <p className="text-gray-600">{product.description}</p>
      <p className="text-2xl font-bold text-gray-900">
        {formatMoney(product.price, product.currency)}
      </p>
      <p className="text-sm text-gray-500">
        {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
      </p>
      <button
        type="button"
        disabled={outOfStock}
        onClick={() => dispatch(productSelected(product))}
        className="rounded-lg bg-gray-900 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {outOfStock ? 'Out of stock' : 'Pay with credit card'}
      </button>
    </main>
  )
}
