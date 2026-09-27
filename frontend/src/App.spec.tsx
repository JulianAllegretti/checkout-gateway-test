import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import App, { Screens } from './App'
import { api } from './features/checkout/api'
import checkoutReducer, {
  productSelected,
} from './features/checkout/checkoutSlice'
import type { Product } from './features/checkout/types'

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

describe('App', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(product),
      clone() {
        return this
      },
    })
  })

  it('boots through the full store/persist chain into step 1 (the product page)', async () => {
    render(<App />)
    expect(await screen.findByText(product.name)).toBeInTheDocument()
  })

  it('renders nothing yet for a step without a screen built', () => {
    const store = configureStore({
      reducer: { checkout: checkoutReducer, [api.reducerPath]: api.reducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(api.middleware),
    })
    store.dispatch(productSelected(product)) // step -> 2

    const { container } = render(
      <Provider store={store}>
        <Screens />
      </Provider>,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
