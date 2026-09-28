import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import App, { Screens } from './App'
import { api } from './features/checkout/api'
import checkoutReducer, {
  productSelected,
  transactionCreated,
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

const approvedTransaction = {
  transactionId: 'tx-1',
  reference: 'ref-1',
  status: 'APPROVED',
  card: { brand: 'VISA', last4: '1111' },
  amount: {
    unitPrice: 350000,
    quantity: 1,
    subtotal: 350000,
    taxRate: 0.19,
    taxAmount: 66500,
    product: 416500,
    baseFee: 5000,
    deliveryFee: 8000,
    total: 429500,
    currency: 'COP',
  },
  createdAt: '2026-09-25T14:03:00.000Z',
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    clone() {
      return this
    },
  }
}

describe('App', () => {
  beforeEach(() => {
    // Routed by URL, not a single fixed body: this file boots the real `api`
    // reducer (unlike component-level specs, which mock the RTK Query hooks
    // directly), so more than one endpoint can be hit within a single test
    // (e.g. screen 4 polling `GET /transactions/:id` while screen 5 is
    // re-fetching `GET /products/current`).
    global.fetch = jest.fn().mockImplementation(async (input: Request) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.includes('/transactions/')) {
        return jsonResponse(approvedTransaction)
      }
      return jsonResponse(product)
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

  it('renders the final status page for step 4', () => {
    const store = configureStore({
      reducer: { checkout: checkoutReducer, [api.reducerPath]: api.reducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(api.middleware),
    })
    store.dispatch(
      transactionCreated({
        transactionId: 'tx-1',
        reference: 'ref-1',
        status: 'APPROVED',
      }),
    )

    render(
      <Provider store={store}>
        <Screens />
      </Provider>,
    )

    expect(screen.getByText('Payment approved')).toBeInTheDocument()
  })

  it('resets the checkout and lands back on the product page from "Back to store"', async () => {
    const user = userEvent.setup()
    const store = configureStore({
      reducer: { checkout: checkoutReducer, [api.reducerPath]: api.reducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(api.middleware),
    })
    store.dispatch(productSelected(product)) // step -> 2, snapshots the product
    store.dispatch(
      transactionCreated({
        transactionId: 'tx-1',
        reference: 'ref-1',
        status: 'APPROVED',
      }),
    ) // step -> 4

    render(
      <Provider store={store}>
        <Screens />
      </Provider>,
    )
    await user.click(screen.getByRole('button', { name: 'Back to store' }))

    // Screen 1 (product page) again, with the checkout state fully reset —
    // proof "back to store" isn't just a step change but a real restart.
    expect(await screen.findByText(product.name)).toBeInTheDocument()
    expect(store.getState().checkout.step).toBe(1)
    expect(store.getState().checkout.productSnapshot).toBeNull()
    expect(store.getState().checkout.transactionId).toBeNull()
  })

  it('renders nothing yet for a step without a screen built', () => {
    const store = configureStore({
      reducer: { checkout: checkoutReducer, [api.reducerPath]: api.reducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(api.middleware),
      preloadedState: {
        checkout: {
          ...checkoutReducer(undefined, { type: '@@INIT' }),
          step: 5 as const,
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
