import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import App, { Screens } from './App'
import { api } from './features/checkout/api'
import checkoutReducer, {
  productSelected,
} from './features/checkout/checkoutSlice'
import type { Product } from './features/checkout/types'
import { getAcceptanceToken, tokenizeCard } from './lib/gatewayClient'

jest.mock('./lib/gatewayClient')

const mockedTokenizeCard = tokenizeCard as jest.Mock
const mockedGetAcceptanceToken = getAcceptanceToken as jest.Mock

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

  it('renders the payment modal for step 2', () => {
    const store = configureStore({
      reducer: { checkout: checkoutReducer, [api.reducerPath]: api.reducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(api.middleware),
    })
    store.dispatch(productSelected(product)) // step -> 2

    render(
      <Provider store={store}>
        <Screens />
      </Provider>,
    )

    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('hands the card token from the payment modal to the summary screen on the 2 -> 3 handoff', async () => {
    const user = userEvent.setup()
    mockedTokenizeCard.mockResolvedValue({
      cardToken: 'tok_test_1',
      brand: 'VISA',
      last4: '1111',
    })
    mockedGetAcceptanceToken.mockResolvedValue('accept_123')
    const store = configureStore({
      reducer: { checkout: checkoutReducer, [api.reducerPath]: api.reducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(api.middleware),
    })
    store.dispatch(productSelected(product)) // step -> 2

    render(
      <Provider store={store}>
        <Screens />
      </Provider>,
    )

    await user.type(screen.getByLabelText('Card number'), '4111 1111 1111 1111')
    await user.type(screen.getByLabelText('Expiry (MM/YY)'), '12/30')
    await user.type(screen.getByLabelText('CVC'), '123')
    await user.type(screen.getByLabelText('Cardholder name'), 'Jane Doe')
    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Doe')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Phone'), '+573001234567')
    await user.type(screen.getByLabelText('Address'), 'Calle 123 #45-67')
    await user.type(screen.getByLabelText('City'), 'Bogotá')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    // Screen 3 renders with the summary's own "Pay" button — proof the
    // card token produced by screen 2 reached it without ever touching Redux.
    expect(
      await screen.findByRole('button', { name: 'Pay' }),
    ).toBeInTheDocument()
    expect(store.getState().checkout.step).toBe(3)
  })

  it('falls back to the payment modal for step 3 when paymentSecrets was lost (e.g. a refresh)', () => {
    const store = configureStore({
      reducer: { checkout: checkoutReducer, [api.reducerPath]: api.reducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(api.middleware),
      preloadedState: {
        checkout: {
          ...checkoutReducer(undefined, { type: '@@INIT' }),
          step: 3 as const,
        },
      },
    })

    render(
      <Provider store={store}>
        <Screens />
      </Provider>,
    )

    // paymentSecrets is always null on a fresh mount (it's local React state,
    // never persisted) — step 3 with nothing to charge with must redo the
    // card step instead of rendering a broken summary.
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('renders nothing yet for a step without a screen built', () => {
    const store = configureStore({
      reducer: { checkout: checkoutReducer, [api.reducerPath]: api.reducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(api.middleware),
      preloadedState: {
        checkout: {
          ...checkoutReducer(undefined, { type: '@@INIT' }),
          step: 4 as const,
        },
      },
    })

    const { container } = render(
      <Provider store={store}>
        <Screens />
      </Provider>,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
