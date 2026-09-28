import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { useGetCurrentProductQuery } from '../features/checkout/api'
import checkoutReducer from '../features/checkout/checkoutSlice'
import type { Product } from '../features/checkout/types'
import { ProductPage } from './ProductPage'

jest.mock('../features/checkout/api')

const mockedUseGetCurrentProductQuery = useGetCurrentProductQuery as jest.Mock

const product: Product = {
  id: 'b3f1c2a0-uuid',
  name: 'Wireless Headphones',
  description: 'Over-ear, active noise cancellation.',
  unitPrice: 350000,
  taxRate: 0.19,
  taxAmount: 66500,
  price: 416500,
  stock: 12,
  imageUrl: 'https://example.com/headphones.jpg',
  baseFee: 5000,
  deliveryFee: 8000,
  currency: 'COP',
}

function renderWithStore() {
  const store = configureStore({ reducer: { checkout: checkoutReducer } })
  render(
    <Provider store={store}>
      <ProductPage />
    </Provider>,
  )
  return store
}

describe('ProductPage', () => {
  it('renders the product and advances to step 2 with a snapshot on click', async () => {
    mockedUseGetCurrentProductQuery.mockReturnValue({
      data: product,
      isLoading: false,
      isError: false,
    })
    const store = renderWithStore()

    expect(screen.getByText(product.name)).toBeInTheDocument()
    expect(screen.getByText(product.description)).toBeInTheDocument()
    // Uses a regex, not the exact formatMoney() output: Intl.NumberFormat's
    // currency spacing character (a non-breaking space) is easy to get
    // subtly wrong when hand-matched against normalized DOM text.
    expect(screen.getByText(/416\.500/)).toBeInTheDocument()
    expect(screen.getByText('12 in stock')).toBeInTheDocument()

    const cta = screen.getByRole('button', { name: 'Pay with credit card' })
    expect(cta).toBeEnabled()
    await userEvent.click(cta)

    expect(store.getState().checkout.step).toBe(2)
    expect(store.getState().checkout.productSnapshot).toEqual(product)
  })

  it('always asks for a fresh fetch, since it can be reached again after a reset', () => {
    mockedUseGetCurrentProductQuery.mockReturnValue({
      data: product,
      isLoading: false,
      isError: false,
    })
    renderWithStore()

    expect(mockedUseGetCurrentProductQuery).toHaveBeenCalledWith(undefined, {
      refetchOnMountOrArgChange: true,
    })
  })

  it('disables and relabels the CTA when out of stock', () => {
    mockedUseGetCurrentProductQuery.mockReturnValue({
      data: { ...product, stock: 0 },
      isLoading: false,
      isError: false,
    })
    renderWithStore()

    expect(screen.getAllByText('Out of stock')).toHaveLength(2) // stock status + CTA label
    expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled()
  })

  it('shows a loading state', () => {
    mockedUseGetCurrentProductQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
    renderWithStore()

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows an error state when the product fails to load', () => {
    mockedUseGetCurrentProductQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })
    renderWithStore()

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })
})
